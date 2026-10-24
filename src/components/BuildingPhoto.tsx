import { useState } from 'react'
import type { Building } from '../lib/types'
import { RowhouseArt, hashString } from './Skyline'

// Aerial photo of the building's location from Esri World Imagery tiles (HUD data has no photos,
// and we don't scrape listing sites). Tiles load from Esri, which sees which coordinates are viewed;
// they are public building locations, never anything the user typed.
const ZOOM = 18
const TILE = 256
const TILE_URL = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`

function toPixels(lat: number, lon: number, z: number) {
  const n = TILE * 2 ** z
  const r = (lat * Math.PI) / 180
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
  }
}

export function BuildingPhoto({
  b,
  className = '',
  zoom = false,
}: {
  b: Building
  className?: string
  zoom?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const { x, y } = toPixels(b.lat, b.lon, ZOOM)
  const tx = Math.floor(x / TILE)
  const ty = Math.floor(y / TILE)
  // A 3x3 block of tiles around the point, shifted so the building sits in the middle of the frame.
  const offsetX = x - (tx - 1) * TILE
  const offsetY = y - (ty - 1) * TILE

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: 'linear-gradient(180deg, #ffe3b0, #ffc1d6)' }}
    >
      {!failed && (
        <div aria-hidden className={`ken-burns absolute inset-0 ${zoom ? 'is-on' : ''}`}>
          <div
            className="absolute grid grid-cols-3"
            style={{
              width: TILE * 3,
              left: `calc(50% - ${offsetX}px)`,
              top: `calc(50% - ${offsetY}px)`,
            }}
          >
            {[-1, 0, 1].flatMap((dy) =>
              [-1, 0, 1].map((dx) => (
                <img
                  key={`${dx},${dy}`}
                  src={TILE_URL(ZOOM, tx + dx, ty + dy)}
                  width={TILE}
                  height={TILE}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  onError={() => setFailed(true)}
                  className="block select-none"
                />
              )),
            )}
          </div>
        </div>
      )}
      {failed && <RowhouseArt seed={hashString(b.id)} className="absolute inset-x-0 bottom-0 h-[85%] w-full" />}
      {/* The pin marks HUD's geocoded point, which can be a few doors off. */}
      <span aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow">
        <svg width="26" height="34" viewBox="0 0 26 34">
          <path
            d="M13 33s11-11.6 11-20A11 11 0 0 0 2 13c0 8.4 11 20 11 20z"
            fill="var(--color-brand)"
            stroke="white"
            strokeWidth="2"
          />
          <circle cx="13" cy="13" r="4" fill="white" />
        </svg>
      </span>
      <span className="sr-only">Aerial photo of the area around {b.name}</span>
      <span className="absolute bottom-1 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
        {failed ? 'Illustration · photo unavailable' : 'Aerial view · Esri, Maxar'}
      </span>
    </div>
  )
}
