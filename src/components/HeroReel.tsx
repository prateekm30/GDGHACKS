import { ArrowRight, MapPin, Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { areaInfo } from '../lib/areas'
import { lihtcRentCeiling } from '../lib/eligibility'
import { programLabel } from '../lib/labels'
import { prefersReducedMotion, tiltHandlers } from '../lib/motion'
import { streetViewUrl, useStreetViewIndex, useStreetViewKey, type StreetViewSource } from '../lib/streetview'
import type { Area, Building, IncomeLimits } from '../lib/types'
import { TileView } from './BuildingPhoto'
import { RowhouseArt, hashString } from './Skyline'

const HOLD_MS = 4600
/**
 * Street View photos are billed per image. The reel plays on its own for this many frames, then waits for a
 * tap, and loads at most STREET_CAP street photos per page view (aerial tiles after that). So a visitor who
 * just reads the page costs about 8 images, once, instead of one every few seconds for as long as the tab is open.
 */
const AUTO_FRAMES = 6
const STREET_CAP = 12

/**
 * One building per area first, then a second lap, so the reel tours the whole region. With the Street View
 * index loaded, only buildings whose street photo is trusted (found by address, agreeing with HUD's point)
 * are used, so every frame is a real street photo; areas without any fall back to the aerial view.
 */
export function pickReel(buildings: Building[], index: Record<string, StreetViewSource> | null = null): Building[] {
  const byArea = new Map<Area, Building[]>()
  const ok = (b: Building) => !b.sample && !b.seniorOnly && !b.disabilityOnly && b.bedrooms.length > 0
  const trusted = index ? buildings.filter((b) => ok(b) && index[b.id] === 'a') : []
  const areasWithPhoto = new Set(trusted.map((b) => b.area))
  for (const b of buildings) {
    if (!ok(b)) continue
    if (index && areasWithPhoto.has(b.area) && index[b.id] !== 'a') continue
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
  const ceiling = b.incomeCeiling === 'avg' || b.incomeCeiling == null ? 60 : b.incomeCeiling
  const cap = lihtcRentCeiling(limits, ceiling, br)
  return `${br === 0 ? 'Studio' : `${br}BR`} capped at $${cap.toLocaleString('en-US')}/mo`
}

/**
 * A slow tour of real buildings: Google's street photo when the index trusts it, the roof and block from the
 * air otherwise. Each frame is a building in HUD's data. Tap or press an arrow for the next one; "Search here" starts the picker in that area.
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
  const apiKey = useStreetViewKey()
  const index = useStreetViewIndex()
  const reel = useMemo(() => (buildings ? pickReel(buildings, index) : []), [buildings, index])
  const [i, setI] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  // Buildings whose street photo did not load (Google has none after all): the aerial view takes over.
  const [noStreet, setNoStreet] = useState<Set<string>>(() => new Set())
  // Street photos load only while the reel is on screen, and only up to STREET_CAP per page view.
  const rootRef = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(false)
  const [requested, setRequested] = useState<ReadonlySet<string>>(() => new Set())
  const [autoSteps, setAutoSteps] = useState(0)
  const streetFor = (f: Building) =>
    !!apiKey && index?.[f.id] === 'a' && !noStreet.has(f.id) && (requested.has(f.id) || (onScreen && requested.size < STREET_CAP))

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setOnScreen(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // The reel changes once the index arrives; start it over so the frame and the label agree.
  useEffect(() => {
    setI(0)
    setPrev(null)
  }, [reel])
  const timer = useRef<number | null>(null)
  const still = useMemo(prefersReducedMotion, [])

  const n = reel.length
  const go = (next: number) => {
    if (!n) return
    setPrev(i)
    setI(((next % n) + n) % n)
  }

  // Auto-advance unless hovered, focused, off screen, hidden, done with its few frames, or the person prefers
  // less motion. After AUTO_FRAMES it waits for a tap.
  const autoRunning = !still && !paused && !stopped && onScreen && n > 1 && autoSteps < AUTO_FRAMES
  useEffect(() => {
    if (!autoRunning || document.visibilityState === 'hidden') return
    timer.current = window.setTimeout(() => {
      setAutoSteps((s) => s + 1)
      go(i + 1)
    }, HOLD_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, autoRunning])

  // Count each street photo once, when it is first shown (the next frame is fetched early only while playing).
  useEffect(() => {
    const want = [reel[i], autoRunning ? reel[(i + 1) % Math.max(n, 1)] : undefined].filter(
      (f): f is Building => !!f && streetFor(f) && !requested.has(f.id),
    )
    if (want.length) setRequested((s) => new Set([...s, ...want.map((f) => f.id)]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, autoRunning, onScreen, apiKey, index, reel])

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
  const streetOn = !!b && streetFor(b)

  return (
    <div
      ref={rootRef}
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
        aria-label={b ? `${streetOn ? 'Street photo' : 'Aerial view'} of ${b.name} in ${b.city}, ${b.state}. Building ${i + 1} of ${n}. Press the right arrow for the next one.` : 'Loading buildings'}
        onKeyDown={onKey}
        onClick={() => go(i + 1)}
        className="absolute inset-0 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-accent"
      >
        {!b && <div className="skeleton absolute inset-0" />}
        {reel.map((f, k) => {
          const active = k === i
          const leaving = k === prev
          // The next frame is fetched ahead only while the reel plays on its own.
          const next = k === (i + 1) % n && autoRunning
          if (!active && !leaving && !next) return null
          return (
            <div
              key={f.id}
              aria-hidden
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${active ? 'z-10 opacity-100' : leaving ? 'z-[5] opacity-0' : 'z-0 opacity-0'}`}
            >
              {failed.has(f.id) ? (
                <RowhouseArt seed={hashString(f.id)} className="absolute inset-x-0 bottom-0 h-[48%] w-full" />
              ) : streetFor(f) ? (
                <img
                  src={streetViewUrl(f, apiKey, 'a', 640, 400)}
                  alt=""
                  loading="eager"
                  decoding="async"
                  draggable={false}
                  onError={() => setNoStreet((s) => new Set(s).add(f.id))}
                  className={`reel-frame absolute inset-0 h-full w-full select-none object-cover ${active && !still ? 'is-on' : ''}`}
                />
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
              <div className="absolute inset-0 mix-blend-color" style={{ background: streetFor(f) ? 'rgb(255 95 162 / 0.07)' : 'rgb(255 95 162 / 0.18)' }} />
            </div>
          )
        })}
        {!streetOn && (
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <span className="ping block size-4 rounded-full bg-accent ring-4 ring-accent/30" />
          </span>
        )}
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
                {programLabel(b)} · {rentLine(b, limits)}
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
                  <span className={`block h-full bg-accent ${k === i % 12 ? (autoRunning ? 'reel-bar' : 'w-full') : k < i % 12 ? 'w-full' : 'w-0'}`} />
                </span>
              ))}
            </div>
            <span className="text-[11px] font-semibold text-white/75">
              {i + 1}/{n} · tap for the next
            </span>
          </div>
        </div>
      )}
      <span className="absolute right-2 top-2 z-20 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/90">{streetOn ? 'Street View · Google' : 'Aerial · Esri, Maxar'}</span>
      {n > 1 && !still && (
        <button
          type="button"
          onClick={() => setStopped((v) => !v)}
          aria-pressed={stopped}
          aria-label={stopped ? 'Play the slideshow' : 'Pause the slideshow'}
          className="absolute left-2 top-2 z-30 grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70 focus-visible:ring-4 focus-visible:ring-accent"
        >
          {stopped ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
        </button>
      )}
    </div>
  )
}
