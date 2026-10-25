import { ArrowRight, Camera, MapPinned, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import { Fragment, useMemo, type CSSProperties } from 'react'
import { AREAS } from '../lib/areas'
import { magneticHandlers, spotlightHandlers, useReveal } from '../lib/motion'
import type { Area, Building, IncomeLimits } from '../lib/types'
import { CountUp } from './CountUp'
import { AreaChecklist, DmvMap } from './DmvMap'
import { HeroReel } from './HeroReel'
import { IncomeDemo, PickDemo, ShortlistDemo } from './MiniDemos'
import { Skyline } from './Skyline'

const STEPS: { title: string; body: string; detail: string; icon: LucideIcon; time: string }[] = [
  {
    title: 'Tell us the basics',
    body: 'Household size, bedrooms, where you work, and what matters most. Income is optional.',
    detail: 'Nothing you type leaves your phone. We use it only to estimate rent and check income limits.',
    icon: ShieldCheck,
    time: 'late afternoon',
  },
  {
    title: 'Pick this or that',
    body: 'Eight quick choices between two real buildings. Each pick teaches it what you like.',
    detail: 'The ranking runs in your browser on building facts only. Never on neighborhoods, schools, or who lives there.',
    icon: Sparkles,
    time: 'dusk',
  },
  {
    title: 'Get your shortlist',
    body: 'Your top matches, what you might pay, who to call, and what to bring.',
    detail: 'Every card shows the income limit, the rent cap or income-based rent, and HUD’s typical rent nearby.',
    icon: MapPinned,
    time: 'night',
  },
]

const HEADLINE = ['Find', 'a', 'home', 'you', 'can', 'afford,']
const HEADLINE_2 = ['one', 'pick', 'at', 'a', 'time.']

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
}: {
  buildings: Building[] | null
  limits: IncomeLimits
  selected: ReadonlySet<Area>
  onToggleArea: (a: Area) => void
  onClearAreas: () => void
  onBegin: () => void
  onStartIn: (a: Area) => void
  onSnap: () => void
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
  const areaNames = AREAS.map((a) => (a.state === 'DC' ? a.name : `${a.name}, ${a.state}`))
  const searchLabel = selected.size === 0 ? 'Search all of the DMV' : `Search ${selected.size} ${selected.size === 1 ? 'area' : 'areas'}`
  let w = 0

  return (
    <div ref={revealRef} className="day">
      {/* ---------- Morning: the hero ---------- */}
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
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-10 pt-5 sm:pt-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div className="px-copy min-w-0 space-y-4">
            <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm">
              <span aria-hidden className="metro-stripe h-2 w-8 rounded-full" />
              For first-time renters across DC, Maryland, and Virginia
            </span>
            <h1 id="start-heading" className="text-[2.6rem] font-extrabold leading-[0.98] text-ink sm:text-6xl lg:text-[3.25rem] xl:text-6xl">
              {HEADLINE.map((word) => (
                <Fragment key={`a-${word}`}>
                  <span className="nudge relative" style={{ animationDelay: `${w++ * 35}ms` }}>
                    {word}
                    {word === 'afford,' && (
                      <svg aria-hidden viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-3 w-[92%]">
                        <path d="M3 14 C 50 4, 120 4, 197 10" pathLength={1} fill="none" stroke="#ff9f43" strokeWidth="6" strokeLinecap="round" className="draw" />
                      </svg>
                    )}
                  </span>{' '}
                </Fragment>
              ))}
              <span className="text-brand-strong">
                {HEADLINE_2.map((word, i) => (
                  <Fragment key={`b-${i}`}>
                    <span className="nudge" style={{ animationDelay: `${w++ * 35}ms` }}>
                      {word}
                    </span>
                    {i < HEADLINE_2.length - 1 ? ' ' : ''}
                  </Fragment>
                ))}
              </span>
            </h1>
            <p className="max-w-xl text-base text-ink sm:text-lg lg:text-base xl:text-lg">
              Compare real income-restricted buildings two at a time. HomePick learns what you like, estimates what you'd pay,
              and hands you a shortlist.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onBegin}
                {...magneticHandlers()}
                className="magnetic sheen group inline-flex min-h-14 items-center justify-between gap-4 rounded-2xl bg-dusk px-5 py-3 text-left font-display text-lg font-bold text-white shadow-lift hover:bg-ink active:scale-[0.98]"
              >
                <span>
                  {searchLabel}
                  <span className="block font-sans text-xs font-medium text-white/80">
                    {chosenCount === null ? 'Loading buildings…' : `${chosenCount.toLocaleString('en-US')} real buildings · about two minutes`}
                  </span>
                </span>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-ink transition-transform duration-200 group-hover:translate-x-1">
                  <ArrowRight aria-hidden className="size-5" />
                </span>
              </button>
              <a
                href="#areas"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/70 px-5 font-semibold text-ink transition hover:bg-white"
              >
                <MapPinned aria-hidden className="size-4 text-brand-strong" />
                Choose my areas first
              </a>
            </div>
            <button
              type="button"
              onClick={onSnap}
              className="group inline-flex max-w-full items-center gap-2 rounded-full bg-white/60 px-3 py-2 text-left text-sm font-semibold text-ink transition hover:bg-white"
            >
              <Camera aria-hidden className="size-4 shrink-0 text-brand-strong" />
              Already have an application form? Snap it into a checklist
              <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          <div className="px-map relative min-w-0">
            <HeroReel buildings={buildings} limits={limits} onStartIn={onStartIn} className="h-[340px] sm:h-[440px]" />
            <p className="font-hand mt-2 text-center text-xl text-ink">real roofs, real blocks: every one is a building in HUD's data</p>
          </div>
        </div>
        <Skyline className="px-skyline relative block h-28 w-full sm:h-36" />
      </section>

      {/* ---------- Afternoon: where ---------- */}
      <section id="areas" aria-labelledby="areas-heading" className="afternoon relative scroll-mt-20 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <span className="glow-orb absolute -left-24 top-10 size-72 rounded-full" style={{ background: 'radial-gradient(circle, rgb(255 197 61 / 0.45), transparent 70%)' }} />
          <span className="glow-orb glow-orb-late absolute -right-20 bottom-0 size-80 rounded-full" style={{ background: 'radial-gradient(circle, rgb(255 95 162 / 0.35), transparent 70%)' }} />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-start gap-6 px-4 py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
          <div className="reveal min-w-0 space-y-4">
            <p className="font-hand text-2xl text-brand-strong">first, where?</p>
            <h2 id="areas-heading" className="text-3xl font-extrabold sm:text-4xl">
              Where do you want to live?
            </h2>
            <p className="text-ink-soft">
              Pick any counties and cities, or none to search all of them. All twelve share the same 2026 income limits.
            </p>
            <div className="space-y-3 rounded-[1.75rem] bg-white/70 p-4 shadow-card ring-1 ring-white backdrop-blur">
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
                className="magnetic sheen group flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl bg-brand px-5 py-3.5 text-left font-display text-lg font-bold text-white shadow-lift hover:bg-brand-strong active:scale-[0.98]"
              >
                <span>
                  {searchLabel}
                  <span className="block font-sans text-xs font-medium text-white/80">
                    {chosenCount === null ? 'Loading buildings…' : `${chosenCount.toLocaleString('en-US')} real buildings`}
                  </span>
                </span>
                <span className="grid size-10 place-items-center rounded-full bg-accent text-ink transition-transform duration-200 group-hover:translate-x-1">
                  <ArrowRight aria-hidden className="size-5" />
                </span>
              </button>
            </div>
          </div>
          <div className="reveal relative min-w-0 rounded-[1.75rem] bg-white/70 p-3 shadow-card ring-1 ring-white backdrop-blur sm:p-4" style={{ '--d': '120ms' } as CSSProperties}>
            <DmvMap selected={selected} onToggle={onToggleArea} buildings={buildings} />
            <p className="font-hand mt-1 text-center text-xl text-ink">tap a county to choose it · each dot is a building</p>
          </div>
        </div>
      </section>

      {/* ---------- Dusk: the numbers ---------- */}
      <section className="dusk relative overflow-hidden text-white">
        <div aria-hidden className="marquee overflow-hidden border-b border-white/10 py-3">
          <div className="marquee-track flex w-max gap-8 whitespace-nowrap font-display text-sm font-bold uppercase tracking-[0.18em] text-white/70">
            {[...areaNames, ...areaNames].map((n, i) => (
              <span key={i} className="flex items-center gap-8">
                {n}
                <span className="size-1.5 rounded-full bg-accent" />
              </span>
            ))}
          </div>
        </div>
        <ul className="relative mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-12 sm:grid-cols-4">
          {[
            { big: buildings?.length ?? 900, small: 'real buildings from HUD data', color: '#ffd166' },
            { big: AREAS.length, small: 'counties and cities across DC, MD, and VA', color: '#e0b3ff' },
            { big: 2026, small: 'income limits, checked against the source', color: '#ffc53d', plain: true },
            { big: 0, small: 'sign-ups. Your answers stay on your device', color: '#ffe0a3' },
          ].map((s, i) => (
            <li key={s.small} className="reveal" style={{ '--d': `${i * 110}ms` } as CSSProperties}>
              <span className="font-display block text-5xl font-extrabold" style={{ color: s.color }}>
                {s.plain ? s.big : <CountUp value={s.big} />}
              </span>
              <span className="text-sm text-white/85">{s.small}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Night: how it works, with working demos ---------- */}
      <section aria-labelledby="how-heading" className="night relative overflow-hidden text-white">
        <div aria-hidden className="stars stars-on absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16">
          <div className="reveal flex flex-wrap items-end justify-between gap-2">
            <h2 id="how-heading" className="text-3xl font-extrabold sm:text-4xl">
              How it works
            </h2>
            <span className="font-hand text-2xl text-accent">three stops, about two minutes. try each one.</span>
          </div>
          {/* Each step pins while the next one slides over it. The previous card shrinks back as it is covered. */}
          <ol className="mt-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`stack-slot ${i < STEPS.length - 1 ? 'min-h-[60svh]' : ''}`}>
                <div className="stack-card night-card sticky overflow-hidden rounded-[2rem] ring-1 ring-white/15" style={{ top: `calc(5.5rem + ${i * 1.25}rem)` }}>
                  <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-10">
                    <span className="font-display grid size-14 place-items-center rounded-full bg-accent text-xl font-extrabold text-ink shadow-[0_0_40px_rgb(111_216_227/0.45)]">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <s.icon aria-hidden className="size-7 text-accent" />
                        <span className="font-hand text-xl text-white/60">{s.time}</span>
                      </div>
                      <h3 className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">{s.title}</h3>
                      <p className="mt-2 max-w-xl text-base text-white/90 sm:text-lg">{s.body}</p>
                      <p className="mt-3 max-w-xl text-sm text-white/65">{s.detail}</p>
                      {i === 0 && <IncomeDemo limits={limits} />}
                      {i === 1 && <PickDemo buildings={buildings} limits={limits} />}
                      {i === 2 && <ShortlistDemo buildings={buildings} />}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="reveal glass-card mt-12 grid items-center gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
            <div>
              <p className="font-hand text-2xl text-accent">got the paperwork?</p>
              <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">Snap an application form, get a checklist</h2>
              <p className="mt-2 max-w-xl text-sm text-white/75">
                Upload a PDF or photo. It's read on your device, then Gemma turns the text you approve into a list of what to
                bring and do. Your photo never leaves your phone.
              </p>
            </div>
            <button
              type="button"
              onClick={onSnap}
              {...magneticHandlers()}
              className="magnetic sheen inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-bold text-ink hover:bg-white active:scale-[0.98]"
            >
              <Camera aria-hidden className="size-5" />
              Snap a form
            </button>
          </div>

          <div className="reveal mt-12 text-center">
            <p className="font-hand text-2xl text-white/70">ready when you are</p>
            <button
              type="button"
              onClick={onBegin}
              {...magneticHandlers()}
              className="magnetic sheen group mt-3 inline-flex min-h-14 items-center gap-4 rounded-2xl bg-white px-6 py-3 font-display text-lg font-bold text-ink shadow-lift hover:bg-accent active:scale-[0.98]"
            >
              {searchLabel}
              <span className="grid size-10 place-items-center rounded-full bg-dusk text-white transition-transform duration-200 group-hover:translate-x-1">
                <ArrowRight aria-hidden className="size-5" />
              </span>
            </button>
          </div>

          <p className="reveal mx-auto mt-10 max-w-2xl text-center text-sm text-white/60">
            Estimates only. Each property decides who qualifies. We never rank by neighborhood, schools, or who lives there.
          </p>
        </div>
        {/* Home at night: the same block, lights on. */}
        <Skyline night className="relative block h-28 w-full sm:h-36" />
      </section>
    </div>
  )
}
