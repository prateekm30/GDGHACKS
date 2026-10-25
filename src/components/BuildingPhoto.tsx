import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useRef, useState, type UIEvent } from 'react'
import { hasStreetView, streetViewUrl } from '../lib/streetview'
import type { Building } from '../lib/types'
import { RowhouseArt, hashString } from './Skyline'

// Views of the building's location from Esri tiles. HUD data has no photos, and we don't take listing photos
// (they belong to the landlords and photographers) or invent interiors. Tiles load from Esri, which sees which
// coordinates are viewed; they are public building locations, never anything the user typed.
const TILE = 256
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const LAYERS = {
  imagery: (z: number, x: number, y: number) => `${ESRI}/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  streets: (z: number, x: number, y: number) => `${ESRI}/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
}

type View = { layer: keyof typeof LAYERS | 'street'; zoom: number; label: string; credit: string }
const STREET_VIEW: View = { layer: 'street', zoom: 0, label: 'Street View', credit: 'Google' }
const VIEWS: View[] = [
  { layer: 'imagery', zoom: 18, label: 'Aerial', credit: 'Esri, Maxar' },
  { layer: 'imagery', zoom: 16, label: 'Neighborhood', credit: 'Esri, Maxar' },
  { layer: 'streets', zoom: 16, label: 'Street map', credit: 'Esri, OSM' },
]

function toPixels(lat: number, lon: number, z: number) {
  const n = TILE * 2 ** z
  const r = (lat * Math.PI) / 180
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n }
}

function Pin() {
  return (
    <span aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow">
      <svg width="26" height="34" viewBox="0 0 26 34">
        <path d="M13 33s11-11.6 11-20A11 11 0 0 0 2 13c0 8.4 11 20 11 20z" fill="var(--color-brand)" stroke="white" strokeWidth="2" />
        <circle cx="13" cy="13" r="4" fill="white" />
      </svg>
    </span>
  )
}

/** A 3x3 block of map tiles, shifted so the building sits in the middle of the frame. */
export function TileView({ b, layer, zoom, onFail, eager = false, className = 'ken-burns' }: { b: Building; layer: keyof typeof LAYERS; zoom: number; onFail: () => void; eager?: boolean; className?: string }) {
  const { x, y } = toPixels(b.lat, b.lon, zoom)
  const tx = Math.floor(x / TILE)
  const ty = Math.floor(y / TILE)
  return (
    <div aria-hidden className={`${className} absolute inset-0`}>
      <div
        className="absolute grid grid-cols-3"
        style={{ width: TILE * 3, left: `calc(50% - ${x - (tx - 1) * TILE}px)`, top: `calc(50% - ${y - (ty - 1) * TILE}px)` }}
      >
        {[-1, 0, 1].flatMap((dy) =>
          [-1, 0, 1].map((dx) => (
            <img
              key={`${dx},${dy}`}
              src={LAYERS[layer](zoom, tx + dx, ty + dy)}
              width={TILE}
              height={TILE}
              alt=""
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              onError={onFail}
              className="block select-none"
            />
          )),
        )}
      </div>
    </div>
  )
}

/** The street-level photo from Google. Hidden (and dropped from the views) when Google has none for this spot. */
function StreetPhoto({ b, onFail, onLoad }: { b: Building; onFail: () => void; onLoad: () => void }) {
  return (
    <img
      src={streetViewUrl(b.lat, b.lon)}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={onFail}
      onLoad={onLoad}
      className="ken-burns absolute inset-0 h-full w-full select-none object-cover"
    />
  )
}

/**
 * Swipeable views of where the building is: a Google Street View photo when one exists, then the aerial
 * close-up, the neighborhood, and a street map, plus a link to open Street View in Google Maps.
 * Falls back to a rowhouse drawing if the tiles can't load.
 */
export function BuildingPhoto({ b, className = '', single = false }: { b: Building; className?: string; single?: boolean }) {
  const [failed, setFailed] = useState(false)
  // 'unknown' while the photo loads; 'none' drops the slide and the aerial view leads instead.
  const [street, setStreet] = useState<'unknown' | 'ok' | 'none'>(hasStreetView() ? 'unknown' : 'none')
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const lead = street === 'none' ? [] : [STREET_VIEW]
  const views = failed ? VIEWS.slice(0, 1) : single ? [...lead, ...VIEWS.slice(0, 1)].slice(0, 1) : [...lead, ...VIEWS]

  function go(i: number, e?: { stopPropagation: () => void }) {
    e?.stopPropagation()
    const el = track.current
    if (!el) return
    const next = (i + views.length) % views.length
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }

  function onScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    setIndex(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)))
  }

  return (
    <div className={`group/photo relative overflow-hidden ${className}`} style={{ background: 'linear-gradient(180deg, #ffe4d6, #ffd6e6)' }}>
      {failed ? (
        <RowhouseArt seed={hashString(b.id)} className="absolute inset-x-0 bottom-0 h-[85%] w-full" />
      ) : (
        <div
          ref={track}
          onScroll={onScroll}
          tabIndex={views.length > 1 ? 0 : -1}
          role="group"
          aria-label={`Map views of ${b.name}. Scroll sideways for more.`}
          className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
          {views.map((v) => (
            <div key={v.label} className="relative h-full w-full shrink-0 snap-center overflow-hidden">
              {v.layer === 'street' ? (
                <>
                  {/* The aerial tiles sit under the photo while it loads, so the frame is never blank. */}
                  {street !== 'ok' && <TileView b={b} layer="imagery" zoom={18} onFail={() => setFailed(true)} />}
                  <StreetPhoto b={b} onFail={() => setStreet('none')} onLoad={() => setStreet('ok')} />
                </>
              ) : (
                <>
                  <TileView b={b} layer={v.layer} zoom={v.zoom} onFail={() => setFailed(true)} />
                  <Pin />
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {failed && <Pin />}

      {views.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous view"
            onClick={(e) => go(index - 1, e)}
            className="absolute left-2 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow transition group-hover/photo:opacity-100 focus-visible:opacity-100"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next view"
            onClick={(e) => go(index + 1, e)}
            className="absolute right-2 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow transition group-hover/photo:opacity-100 focus-visible:opacity-100"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
          <span aria-hidden className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/35 px-2 py-1">
            {views.map((v, i) => (
              <span key={v.label} className={`h-1.5 rounded-full bg-white transition-all duration-300 ${i === index ? 'w-4' : 'w-1.5 opacity-60'}`} />
            ))}
          </span>
        </>
      )}

      <span className="absolute bottom-1.5 right-1.5 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
        {failed ? 'Illustration · map unavailable' : `${views[Math.min(index, views.length - 1)]?.label} · ${views[Math.min(index, views.length - 1)]?.credit}`}
      </span>
      {!single && (
        <a
          href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${b.lat},${b.lon}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-1.5 left-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ink shadow transition hover:bg-accent"
        >
          {street === 'ok' ? 'Look around' : 'Street View'}
          <ExternalLink aria-hidden className="size-3" />
          <span className="sr-only">for {b.name} (opens Google Maps Street View)</span>
        </a>
      )}
    </div>
  )
}
