import { memo, useEffect, useMemo, useState } from 'react'
import { AREAS, areaInfo } from '../lib/areas'
import type { Area, Building } from '../lib/types'

interface Shape {
  fips: string
  name: string
  area: Area
  rings: [number, number][][]
}

// Loaded once and shared, so going back to the landing page doesn't refetch.
let shapesPromise: Promise<Shape[] | null> | null = null
function loadShapes() {
  shapesPromise ??= fetch('/data/dmv-map.json')
    .then((r) => (r.ok ? (r.json() as Promise<Shape[]>) : null))
    .catch(() => null)
  return shapesPromise
}

const W = 600
const PAD = 8

/**
 * County outlines (Census TIGERweb) drawn as SVG. Clicking a county toggles its area.
 * Decorative for screen readers: the checkbox list next to it is the accessible control.
 */
export const DmvMap = memo(function DmvMap({
  selected,
  onToggle,
  buildings,
  className = '',
}: {
  selected: ReadonlySet<Area>
  onToggle: (a: Area) => void
  buildings: Building[] | null
  className?: string
}) {
  const [shapes, setShapes] = useState<Shape[] | null>(null)
  const [hover, setHover] = useState<Area | null>(null)

  useEffect(() => {
    let live = true
    loadShapes().then((s) => live && setShapes(s))
    return () => {
      live = false
    }
  }, [])

  const geo = useMemo(() => {
    if (!shapes?.length) return null
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const s of shapes)
      for (const ring of s.rings)
        for (const [x, y] of ring) {
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
    // Equirectangular with longitude shrunk by cos(latitude): close enough at this scale.
    const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180)
    const scale = (W - PAD * 2) / ((maxX - minX) * k)
    const H = Math.round((maxY - minY) * scale + PAD * 2)
    const px = (lon: number) => PAD + (lon - minX) * k * scale
    const py = (lat: number) => PAD + (maxY - lat) * scale
    const paths = shapes.map((s) => ({
      ...s,
      d: s.rings.map((r) => 'M' + r.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join('L') + 'Z').join(''),
    }))
    return { paths, H, px, py }
  }, [shapes])

  if (!geo) {
    return <div aria-hidden className={`skeleton rounded-card ${className}`} style={{ aspectRatio: '1 / 1' }} />
  }

  const all = selected.size === 0
  const on = (a: Area) => all || selected.has(a)
  const shown = hover ?? null

  return (
    <div className={`relative ${className}`}>
      <svg aria-hidden viewBox={`0 0 ${W} ${geo.H}`} className="h-auto w-full drop-shadow-[0_10px_20px_rgb(42_31_77/0.18)]">
        {geo.paths.map((p, i) => (
          <path
            key={p.fips}
            d={p.d}
            fillRule="evenodd"
            fill={areaInfo(p.area).color}
            fillOpacity={on(p.area) ? (hover === p.area ? 1 : 0.88) : 0.18}
            stroke="#fffaf6"
            strokeWidth={hover === p.area ? 3 : 1.5}
            strokeLinejoin="round"
            className="map-county cursor-pointer transition-[fill-opacity,stroke-width] duration-200"
            style={{ animationDelay: `${i * 40}ms` }}
            onClick={() => onToggle(p.area)}
            onPointerEnter={() => setHover(p.area)}
            onPointerLeave={() => setHover((h) => (h === p.area ? null : h))}
          />
        ))}
        <BuildingDots buildings={buildings} selected={selected} px={geo.px} py={geo.py} />
      </svg>
      <div
        aria-hidden
        className={`pointer-events-none absolute left-3 top-3 rounded-xl bg-dusk/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lift transition-all duration-200 ${
          shown ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
        }`}
      >
        {shown && (
          <>
            {areaInfo(shown).name}, {areaInfo(shown).state} ·{' '}
            {buildings ? buildings.filter((b) => b.area === shown).length : '…'} buildings
          </>
        )}
      </div>
    </div>
  )
})

/**
 * One dot per building, so you can see where the homes actually are. 1,700 dots as two <path>s (on and off areas),
 * not 1,700 <circle>s: the browser lays out and paints two elements instead of hundreds.
 */
const BuildingDots = memo(function BuildingDots({
  buildings,
  selected,
  px,
  py,
}: {
  buildings: Building[] | null
  selected: ReadonlySet<Area>
  px: (lon: number) => number
  py: (lat: number) => number
}) {
  const { on, off } = useMemo(() => {
    const all = selected.size === 0
    const dot = (b: Building, r: number) => {
      const x = px(b.lon).toFixed(1)
      const y = py(b.lat).toFixed(1)
      return `M${x} ${y}m${-r} 0a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`
    }
    let on = ''
    let off = ''
    for (const b of buildings ?? []) {
      if (all || selected.has(b.area)) on += dot(b, 2.4)
      else off += dot(b, 1.4)
    }
    return { on, off }
  }, [buildings, selected, px, py])
  return (
    <>
      {off && <path d={off} fill="#2a1a3a" fillOpacity={0.25} pointerEvents="none" />}
      {on && <path d={on} fill="#2a1a3a" fillOpacity={0.8} stroke="#fffaf6" strokeWidth={0.6} pointerEvents="none" />}
    </>
  )
})

/** The accessible picker: one checkbox per area, with building counts. */
export function AreaChecklist({
  selected,
  onToggle,
  counts,
}: {
  selected: ReadonlySet<Area>
  onToggle: (a: Area) => void
  counts: Map<Area, number> | null
}) {
  return (
    <fieldset>
      <legend className="sr-only">Areas to search</legend>
      <div className="-mx-4 flex max-w-[calc(100%+2rem)] snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 lg:gap-1.5">
        {AREAS.map((a) => {
          const checked = selected.has(a.id)
          return (
            <label
              key={a.id}
              className={`group inline-flex shrink-0 snap-start items-center gap-2 rounded-full border-2 py-1.5 pl-1.5 pr-3 text-sm font-semibold lg:gap-1.5 lg:py-1 lg:pl-1 lg:pr-2.5 lg:text-[13px] transition duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                checked ? 'border-dusk bg-dusk text-white shadow-lift' : 'border-white/70 bg-white/60 text-ink hover:-translate-y-0.5 hover:bg-white'
              }`}
            >
              <input type="checkbox" className="sr-only" checked={checked} onChange={() => onToggle(a.id)} />
              <span
                aria-hidden
                className={`grid size-6 place-items-center rounded-full transition-transform lg:size-5 duration-200 ${checked ? 'scale-110' : ''}`}
                style={{ background: a.color }}
              >
                {checked && (
                  <svg viewBox="0 0 16 16" className="pop size-3.5">
                    <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="#2a1a3a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="whitespace-nowrap">
                {a.short}
                <span className={`ml-1 text-xs font-medium ${checked ? 'text-white/80' : 'text-ink-soft'}`}>
                  {a.state !== 'DC' && <span className="sr-only">, {a.state}, </span>}
                  {counts ? counts.get(a.id) ?? 0 : ''}
                  <span className="sr-only"> buildings</span>
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
