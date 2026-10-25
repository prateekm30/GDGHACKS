import { ArrowRight, Camera, MapPinned } from 'lucide-react'
import { useMemo, type CSSProperties } from 'react'
import { magneticHandlers, spotlightHandlers, useReveal } from '../lib/motion'
import type { Area, Building, IncomeLimits } from '../lib/types'
import { AreaChecklist, DmvMap } from './DmvMap'
import { HeroReel } from './HeroReel'
import { Petals } from './Petals'
import { Skyline } from './Skyline'
import { money } from './ui'

const HEADLINE_LINES = ['Income-restricted', 'homes you can', 'actually afford,']
const HEADLINE_2 = 'one pick at a time.'

function Cloud({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 120 40" className={className}>
      <path d="M10 32a12 12 0 0 1 8-21 16 16 0 0 1 30-4 13 13 0 0 1 22 6 10 10 0 0 1 4 19z" fill="#fff" />
    </svg>
  )
}

/**
 * The landing page is one day in the DMV: morning in the hero, afternoon over the map, dusk at the numbers,
 * night by the time you reach the steps. Scrolling moves the sun; windows come on as it gets dark.
 */
export function Landing({
  buildings,
  limits,
  selected,
  onToggleArea,
  onClearAreas,
  onBegin,
  onStartIn,
  onSnap,
  firstVisit = false,
  onHow,
  onAbout,
}: {
  buildings: Building[] | null
  limits: IncomeLimits
  selected: ReadonlySet<Area>
  onToggleArea: (a: Area) => void
  onClearAreas: () => void
  onBegin: () => void
  onStartIn: (a: Area) => void
  onSnap: () => void
  /** The intro zoom is playing: hold the headline words back until the page has settled. */
  firstVisit?: boolean
  onHow: () => void
  onAbout: () => void
}) {
  const revealRef = useReveal<HTMLDivElement>()
  const counts = useMemo(() => {
    if (!buildings) return null
    const m = new Map<Area, number>()
    for (const b of buildings) m.set(b.area, (m.get(b.area) ?? 0) + 1)
    return m
  }, [buildings])
  const chosenCount = counts
    ? selected.size === 0
      ? (buildings?.length ?? 0)
      : [...selected].reduce((n, a) => n + (counts.get(a) ?? 0), 0)
    : null
  // Homes, not just buildings: a building here holds anywhere from 4 to 2,000 income-restricted apartments.
  const chosenHomes = buildings
    ? buildings.filter((b) => selected.size === 0 || selected.has(b.area)).reduce((n, b) => n + (b.affordableUnits ?? 0), 0)
    : null
  const homesText = chosenHomes ? ` · ${Math.round(chosenHomes / 1000).toLocaleString('en-US')}k homes` : ''
  const searchLabel = selected.size === 0 ? 'Search all of the DMV' : `Search ${selected.size} ${selected.size === 1 ? 'area' : 'areas'}`
  let w = 0

  return (
    <div ref={revealRef} className="day" style={{ '--wb': firstVisit ? '900ms' : '0ms' } as CSSProperties}>
      {/* ---------- Morning: the hero. On a first visit it grows out of the sunrise (the wrapper zooms, not the whole page). ---------- */}
      <div className={firstVisit ? 'intro-run' : undefined}>
      <section aria-labelledby="start-heading" {...spotlightHandlers()} className="hero relative overflow-hidden">
        {/* Sky layers. The sun sinks and the night veil rises as you scroll (CSS scroll timelines). */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="px-sun absolute -right-20 -top-16 lg:left-[47%] lg:-top-12 lg:right-auto">
            <svg viewBox="0 0 200 200" className="sun-rise size-64 opacity-70 lg:size-32 lg:opacity-100">
              <circle cx="100" cy="100" r="96" fill="#fff3b0" className="sun-glow" />
              <circle cx="100" cy="100" r="62" fill="#ffc53d" />
            </svg>
          </div>
          <div className="px-cloud absolute inset-0">
            <Cloud className="drift absolute top-[12%] w-36 opacity-80" />
            <Cloud className="drift-slow absolute top-[48%] w-24 opacity-70" />
          </div>
          <div className="night-veil absolute inset-0" />
          <div className="stars absolute inset-0" />
          <div className="spotlight absolute inset-0" />
          <Petals count={12} />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-8 pt-20 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div className="px-copy min-w-0 space-y-4">
            <p className="eyebrow hero-in flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-ink/70" style={{ '--i': 0 } as CSSProperties}>
              <span aria-hidden className="metro-stripe h-px w-10" />
              Income-restricted apartments · DC, Maryland, Virginia
            </p>
            <h1 id="start-heading" className="text-[2.3rem] font-extrabold leading-[0.96] text-ink sm:text-6xl lg:text-[3.3rem] xl:text-[3.7rem]">
              {HEADLINE_LINES.map((line) => (
                <span key={line} className="ln-mask">
                  <span className="ln relative" style={{ '--i': w++ } as CSSProperties}>
                    {line.endsWith('afford,') ? (
                      <>
                        {line.slice(0, -'afford,'.length)}
                        <span className="relative inline-block">
                          afford,{' '}
                          <svg aria-hidden viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-3 w-[86%]">
                            <path d="M3 14 C 50 4, 120 4, 197 10" pathLength={1} fill="none" stroke="#ff9f43" strokeWidth="6" strokeLinecap="round" className="draw" />
                          </svg>
                        </span>
                      </>
                    ) : (
                      line
                    )}{' '}
                  </span>
                </span>
              ))}
              <span className="ln-mask text-brand-strong">
                <span className="ln" style={{ '--i': w++ } as CSSProperties}>
                  {HEADLINE_2}
                </span>
              </span>
            </h1>
            <p className="hero-in max-w-xl text-base text-ink sm:text-lg lg:text-base xl:text-lg" style={{ '--i': 5 } as CSSProperties}>
              Income-restricted means the rent is capped, or set by your income, because the building took public money. Earn under the
              limit and you can apply: in 2026 that is up to <strong>{money(limits.mtsp['60'][0] ?? 0)}</strong> a year for one person at most tax-credit buildings.{' '}
              <button type="button" onClick={onAbout} className="font-semibold text-brand-strong underline decoration-2 underline-offset-4 hover:text-brand">
                What is income-restricted housing?
              </button>
            </p>
            <p className="hero-in flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-[0.14em] text-ink/70" style={{ '--i': 6 } as CSSProperties}>
              <span>{chosenCount === null ? '…' : chosenCount.toLocaleString('en-US')} income-restricted buildings</span>
              <span>{chosenHomes ? `about ${Math.round(chosenHomes / 1000).toLocaleString('en-US')},000 homes` : '…'}</span>
              <span>Public records only</span>
            </p>

            <div className="hero-in flex flex-col gap-3 sm:flex-row sm:items-center" style={{ '--i': 7 } as CSSProperties}>
              <button
                type="button"
                onClick={onBegin}
                {...magneticHandlers()}
                className="magnetic sheen group inline-flex min-h-14 items-center justify-between gap-4 rounded-xl bg-dusk px-5 py-3 text-left font-display text-lg font-bold text-white shadow-lift hover:bg-ink active:scale-[0.98]"
              >
                <span>
                  {searchLabel}
                  <span className="block font-sans text-xs font-medium text-white/80">
                    {chosenCount === null ? 'Loading buildings…' : `${chosenCount.toLocaleString('en-US')} buildings${homesText} · about two minutes`}
                  </span>
                </span>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-ink transition-transform duration-200 group-hover:translate-x-1">
                  <ArrowRight aria-hidden className="size-5" />
                </span>
              </button>
              <a
                href="#areas"
                className="liquid-glass inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold text-ink transition hover:bg-white/55"
              >
                <MapPinned aria-hidden className="size-4 text-brand-strong" />
                Choose my areas first
              </a>
            </div>
            <button
              type="button"
              onClick={onSnap}
              className="liquid-glass group inline-flex max-w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink transition hover:bg-white/55"
            >
              <Camera aria-hidden className="size-4 shrink-0 text-brand-strong" />
              Already have an application form? Snap it into a checklist
              <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          <div className="px-map frame-reveal relative min-w-0">
            <HeroReel buildings={buildings} limits={limits} onStartIn={onStartIn} className="h-[340px] sm:h-[440px]" />
            <p className="font-hand mt-2 text-center text-xl text-ink">real streets, real doors: every one is a building in HUD's data</p>
          </div>
        </div>
        <Skyline className="px-skyline relative block h-28 w-full sm:h-36" />
      </section>

      {/* ---------- Afternoon: where ---------- */}
      </div>
      <section id="areas" aria-labelledby="areas-heading" className="afternoon relative scroll-mt-20 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <span className="glow-orb absolute -left-24 top-10 size-72 rounded-full" style={{ background: 'radial-gradient(circle, rgb(255 197 61 / 0.45), transparent 70%)' }} />
          <span className="glow-orb glow-orb-late absolute -right-20 bottom-0 size-80 rounded-full" style={{ background: 'radial-gradient(circle, rgb(255 95 162 / 0.35), transparent 70%)' }} />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-start gap-6 px-4 py-10 lg:grid-cols-[1fr_1.05fr] lg:gap-8">
          <div className="reveal min-w-0 space-y-4">
            <p className="font-hand text-2xl text-brand-strong">first, where?</p>
            <h2 id="areas-heading" className="text-3xl font-extrabold sm:text-4xl">
              Where do you want to live?
            </h2>
            <p className="text-ink-soft">
              Pick any counties and cities, or none to search all of them. All twelve share the same 2026 income limits.
            </p>
            <div className="glass-panel space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">Areas</span>
                {selected.size > 0 && (
                  <button type="button" onClick={onClearAreas} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-brand-strong hover:bg-brand-tint">
                    Clear
                  </button>
                )}
              </div>
              <AreaChecklist selected={selected} onToggle={onToggleArea} counts={counts} />
              <button
                type="button"
                onClick={onBegin}
                {...magneticHandlers()}
                className="magnetic sheen group flex min-h-13 w-full items-center justify-between gap-3 rounded-xl bg-brand px-5 py-3.5 text-left font-display text-lg font-bold text-white shadow-lift hover:bg-brand-strong active:scale-[0.98]"
              >
                <span>
                  {searchLabel}
                  <span className="block font-sans text-xs font-medium text-white/80">
                    {chosenCount === null ? 'Loading buildings…' : `${chosenCount.toLocaleString('en-US')} buildings${homesText}`}
                  </span>
                </span>
                <span className="grid size-10 place-items-center rounded-full bg-accent text-ink transition-transform duration-200 group-hover:translate-x-1">
                  <ArrowRight aria-hidden className="size-5" />
                </span>
              </button>
            </div>
          </div>
          <div className="glass-panel reveal relative min-w-0 p-3 sm:p-4" style={{ '--d': '120ms' } as CSSProperties}>
            <DmvMap selected={selected} onToggle={onToggleArea} buildings={buildings} />
            <p className="font-hand mt-1 text-center text-xl text-ink">tap a county to choose it · each dot is a building</p>
          </div>
          <p className="reveal text-sm text-ink-soft lg:col-span-2">
            New to income-restricted housing?{' '}
            <button type="button" onClick={onHow} className="font-semibold text-brand-strong underline-offset-4 hover:underline">
              See how it works, with live demos
            </button>
            .
          </p>
        </div>
      </section>

    </div>
  )
}
