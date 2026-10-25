import { ArrowRight, MapPin } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { areaInfo } from '../lib/areas'
import { lihtcRentCeiling } from '../lib/eligibility'
import { prefersReducedMotion, tiltHandlers } from '../lib/motion'
import type { Area, Building, IncomeLimits } from '../lib/types'
import { TileView } from './BuildingPhoto'
import { RowhouseArt, hashString } from './Skyline'

const HOLD_MS = 4600

/** One building per area first, then a second lap, so the reel tours the whole region. */
function pickReel(buildings: Building[]): Building[] {
  const byArea = new Map<Area, Building[]>()
  for (const b of buildings) {
    if (b.sample || b.seniorOnly || b.disabilityOnly || !b.bedrooms.length) continue
    const list = byArea.get(b.area) ?? []
    list.push(b)
    byArea.set(b.area, list)
  }
  const out: Building[] = []
  for (let lap = 0; lap < 2; lap++) {
    for (const [, list] of byArea) {
      // Stable choice per lap: hash the ids so the reel is the same on every visit.
      const sorted = [...list].sort((a, b) => hashString(a.id + lap) - hashString(b.id + lap))
      const b = sorted[lap]
      if (b) out.push(b)
    }
  }
  return out
}

function rentLine(b: Building, limits: IncomeLimits): string {
  if (b.program === 'HUD') return 'Rent set by your income'
  const br = b.bedrooms.includes(1) ? 1 : Math.min(...b.bedrooms)
  const ceiling = b.incomeCeiling === 50 ? 50 : 60
  const cap = lihtcRentCeiling(limits, ceiling, br)
  return `${br === 0 ? 'Studio' : `${br}BR`} capped at $${cap.toLocaleString('en-US')}/mo`
}

/**
 * A slow tour over real buildings, from the air. Each frame is the actual roof and block of a building in HUD's
 * data. Tap or press an arrow for the next one; "Search here" starts the picker in that area.
 */
export function HeroReel({
  buildings,
  limits,
  onStartIn,
  className = '',
}: {
  buildings: Building[] | null
  limits: IncomeLimits
  onStartIn: (area: Area) => void
  className?: string
}) {
  const reel = useMemo(() => (buildings ? pickReel(buildings) : []), [buildings])
  const [i, setI] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  const timer = useRef<number | null>(null)
  const still = useMemo(prefersReducedMotion, [])

  const n = reel.length
  const go = (next: number) => {
    if (!n) return
    setPrev(i)
    setI(((next % n) + n) % n)
  }

  // Auto-advance unless hovered, focused, hidden, or the person prefers less motion.
  useEffect(() => {
    if (still || paused || n < 2 || document.visibilityState === 'hidden') return
    timer.current = window.setTimeout(() => go(i + 1), HOLD_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, paused, n, still])

  // Clear the outgoing frame once its fade is done.
  useEffect(() => {
    if (prev === null) return
    const t = window.setTimeout(() => setPrev(null), 900)
    return () => window.clearTimeout(t)
  }, [prev])

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      go(i + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(i - 1)
    }
  }

  const b = reel[i]
  const area = b ? areaInfo(b.area) : null

  return (
    <div
      className={`tilt group/reel relative overflow-hidden rounded-[2rem] bg-dusk shadow-lift ring-1 ring-white/70 ${className}`}
      {...tiltHandlers(4)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={(e) => {
        tiltHandlers().onPointerLeave(e)
        setPaused(false)
      }}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* The frames. The outgoing one fades under the incoming one. */}
      <div
        role="group"
        tabIndex={0}
        aria-roledescription="slideshow"
        aria-label={b ? `Aerial view of ${b.name} in ${b.city}, ${b.state}. Building ${i + 1} of ${n}. Press the right arrow for the next one.` : 'Loading buildings'}
        onKeyDown={onKey}
        onClick={() => go(i + 1)}
        className="absolute inset-0 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-accent"
      >
        {!b && <div className="skeleton absolute inset-0" />}
        {reel.map((f, k) => {
          const active = k === i
          const leaving = k === prev
          const next = k === (i + 1) % n
          if (!active && !leaving && !next) return null
          return (
            <div
              key={f.id}
              aria-hidden
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${active ? 'z-10 opacity-100' : leaving ? 'z-[5] opacity-0' : 'z-0 opacity-0'}`}
            >
              {failed.has(f.id) ? (
                <RowhouseArt seed={hashString(f.id)} className="absolute inset-x-0 bottom-0 h-[48%] w-full" />
              ) : (
                <TileView
                  b={f}
                  layer="imagery"
                  zoom={18}
                  eager={active || next}
                  className={`reel-frame ${active && !still ? 'is-on' : ''}`}
                  onFail={() => setFailed((s) => new Set(s).add(f.id))}
                />
              )}
              {/* Cinematic grade: a cool tint and a vignette so the labels read. */}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(14_26_51/0.15),transparent_35%,transparent_55%,rgb(14_26_51/0.82))]" />
              <div className="absolute inset-0 mix-blend-color" style={{ background: 'rgb(255 95 162 / 0.18)' }} />
            </div>
          )
        })}
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <span className="ping block size-4 rounded-full bg-accent ring-4 ring-accent/30" />
        </span>
        <span aria-hidden className="glare pointer-events-none absolute inset-0 z-20" />
      </div>

      {/* Label */}
      {b && area && (
        <div key={b.id} className="reel-label pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 text-white sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur">
                <span className="size-2 rounded-full" style={{ background: area.color }} />
                {area.state === 'DC' ? 'Washington, DC' : `${area.short}, ${area.state}`}
              </span>
              <p className="mt-2 truncate font-display text-xl font-extrabold leading-tight sm:text-2xl">{b.name}</p>
              <p className="truncate text-sm text-white/80">
                {b.program === 'HUD' ? 'HUD-assisted' : 'Tax-credit'} · {rentLine(b, limits)}
                {b.metroStation ? ` · ${b.metroStation} Metro` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onStartIn(b.area)
              }}
              className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-ink shadow transition hover:-translate-y-0.5 hover:bg-white"
            >
              <MapPin aria-hidden className="size-4" />
              Search here
              <span className="sr-only">: start in {area.name}</span>
              <ArrowRight aria-hidden className="size-4" />
            </button>
          </div>
          <div aria-hidden className="mt-3 flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {reel.slice(0, Math.min(n, 12)).map((f, k) => (
                <span key={f.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                  <span className={`block h-full bg-accent ${k === i % 12 ? (still || paused ? 'w-full' : 'reel-bar') : k < i % 12 ? 'w-full' : 'w-0'}`} />
                </span>
              ))}
            </div>
            <span className="text-[11px] font-semibold text-white/75">
              {i + 1}/{n} · tap for the next
            </span>
          </div>
        </div>
      )}
      <span className="absolute right-2 top-2 z-20 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/90">Aerial · Esri, Maxar</span>
    </div>
  )
}
