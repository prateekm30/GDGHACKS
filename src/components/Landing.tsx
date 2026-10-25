import { ArrowRight, Camera, MapPinned, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import { useMemo, type CSSProperties } from 'react'
import { AREAS } from '../lib/areas'
import { magneticHandlers, spotlightHandlers, useReveal } from '../lib/motion'
import type { Area, Building } from '../lib/types'
import { CountUp } from './CountUp'
import { AreaChecklist, DmvMap } from './DmvMap'
import { Skyline } from './Skyline'

const STEPS: { title: string; body: string; detail: string; icon: LucideIcon }[] = [
  {
    title: 'Tell us the basics',
    body: 'Household size, bedrooms, where you work, and what matters most. Income is optional.',
    detail: 'Nothing you type leaves your phone. We use it only to estimate rent and check income limits.',
    icon: ShieldCheck,
  },
  {
    title: 'Pick this or that',
    body: 'Eight quick choices between two real buildings. Each pick teaches it what you like.',
    detail: 'The ranking runs in your browser on building facts only. Never on neighborhoods, schools, or who lives there.',
    icon: Sparkles,
  },
  {
    title: 'Get your shortlist',
    body: 'Your top matches, what you might pay, who to call, and what to bring.',
    detail: 'Every card shows the income limit, the rent cap or income-based rent, and HUD’s typical rent nearby.',
    icon: MapPinned,
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

export function Landing({
  buildings,
  selected,
  onToggleArea,
  onClearAreas,
  onBegin,
  onSnap,
}: {
  buildings: Building[] | null
  selected: ReadonlySet<Area>
  onToggleArea: (a: Area) => void
  onClearAreas: () => void
  onBegin: () => void
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
  let w = 0

  return (
    <div ref={revealRef}>
      <section
        aria-labelledby="start-heading"
        {...spotlightHandlers()}
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(170deg, #e2eeff 0%, #cfe0fe 45%, #c9d3fa 100%)' }}
      >
        {/* Sky: sun and clouds sit on their own scroll speeds, so the hero has depth as you scroll. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="px-sun absolute -right-20 -top-16 lg:bottom-6 lg:right-[38%] lg:top-auto">
            <svg viewBox="0 0 200 200" className="sun-rise size-64 opacity-70 lg:size-40 lg:opacity-100">
              <circle cx="100" cy="100" r="96" fill="#e6f6ff" className="sun-glow" />
              <circle cx="100" cy="100" r="62" fill="#a9e4f0" />
            </svg>
          </div>
          <div className="px-cloud absolute inset-0">
            <Cloud className="drift absolute top-[12%] w-36 opacity-80" />
            <Cloud className="drift-slow absolute top-[48%] w-24 opacity-70" />
          </div>
          <div className="spotlight absolute inset-0" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-start gap-6 px-4 pb-10 pt-5 sm:pt-8 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
          <div className="px-copy min-w-0 space-y-4">
            <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm">
              <span aria-hidden className="metro-stripe h-2 w-8 rounded-full" />
              For first-time renters across DC, Maryland, and Virginia
            </span>
            <h1 id="start-heading" className="text-[2.6rem] font-extrabold leading-[0.98] text-ink sm:text-6xl lg:text-[3.25rem] xl:text-6xl">
              {HEADLINE.map((word) => (
                <span key={`a-${word}`} className="nudge relative mr-[0.22em]" style={{ animationDelay: `${w++ * 35}ms` }}>
                  {word}
                  {word === 'afford,' && (
                    <svg aria-hidden viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-3 w-[92%]">
                      <path d="M3 14 C 50 4, 120 4, 197 10" pathLength={1} fill="none" stroke="#22b8cf" strokeWidth="6" strokeLinecap="round" className="draw" />
                    </svg>
                  )}
                </span>
              ))}
              <span className="text-brand-strong">
                {HEADLINE_2.map((word, i) => (
                  <span key={`b-${i}`} className="nudge mr-[0.22em]" style={{ animationDelay: `${w++ * 35}ms` }}>
                    {word}
                  </span>
                ))}
              </span>
            </h1>
            <p className="max-w-xl text-base text-ink sm:text-lg lg:text-base xl:text-lg">
              Compare real income-restricted buildings two at a time. HomePick learns what you like, estimates what you'd pay,
              and hands you a shortlist.
            </p>

            <div className="space-y-3 rounded-[1.75rem] bg-white/45 p-4 shadow-card ring-1 ring-white/70 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-ink" style={{ fontFamily: 'var(--font-sans)', letterSpacing: 0 }}>
                  Where do you want to live?{' '}
                  <span className="font-medium text-ink-soft">Pick any, or none for all.</span>
                </h2>
                {selected.size > 0 && (
                  <button type="button" onClick={onClearAreas} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-brand-strong hover:bg-white/60">
                    Clear
                  </button>
                )}
              </div>
              <AreaChecklist selected={selected} onToggle={onToggleArea} counts={counts} />
              <button
                type="button"
                onClick={onBegin}
                {...magneticHandlers()}
                className="magnetic sheen group flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl bg-dusk px-5 py-3.5 text-left font-display text-lg font-bold text-white shadow-lift hover:bg-ink active:scale-[0.98]"
              >
                <span>
                  {selected.size === 0 ? 'Search all of the DMV' : `Search ${selected.size} ${selected.size === 1 ? 'area' : 'areas'}`}
                  <span className="block font-sans text-xs font-medium text-white/80">
                    {chosenCount === null ? 'Loading buildings…' : `${chosenCount.toLocaleString('en-US')} real buildings`}
                  </span>
                </span>
                <span className="grid size-10 place-items-center rounded-full bg-accent text-ink transition-transform duration-200 group-hover:translate-x-1">
                  <ArrowRight aria-hidden className="size-5" />
                </span>
              </button>
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

          <div className="px-map relative min-w-0 rounded-[1.75rem] bg-white/35 p-3 shadow-card ring-1 ring-white/70 backdrop-blur-md sm:p-4">
            <DmvMap selected={selected} onToggle={onToggleArea} buildings={buildings} />
            <p className="font-hand mt-1 text-center text-xl text-ink">tap a county to choose it · each dot is a building</p>
          </div>
        </div>
        <Skyline className="px-skyline relative block h-28 w-full sm:h-36" />
      </section>

      <div aria-hidden className="metro-stripe h-2" />

      <section className="bg-dusk text-white">
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
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4">
          {[
            { big: buildings?.length ?? 900, small: 'real buildings from HUD data', color: '#7dd3fc' },
            { big: AREAS.length, small: 'counties and cities across DC, MD, and VA', color: '#a5b4fc' },
            { big: 2026, small: 'income limits, checked against the source', color: '#6fd8e3', plain: true },
            { big: 0, small: 'sign-ups. Your answers stay on your device', color: '#bae6fd' },
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

      <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-16">
        <div className="reveal flex flex-wrap items-end justify-between gap-2">
          <h2 id="how-heading" className="text-3xl font-extrabold sm:text-4xl">
            How it works
          </h2>
          <span className="font-hand text-2xl text-brand-strong">three stops, about two minutes</span>
        </div>
        {/* Each step pins while the next one slides over it. The previous card shrinks back as it is covered. */}
        <ol className="mt-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`stack-slot ${i < STEPS.length - 1 ? 'min-h-[56svh]' : ''}`}>
              <div
                className="stack-card sticky overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-white"
                style={{
                  top: `calc(5.5rem + ${i * 1.25}rem)`,
                  background: ['linear-gradient(135deg, #e2eafc, #dff5f8)', 'linear-gradient(135deg, #d6e5fd, #c7d2fe)', 'linear-gradient(135deg, #141a3f, #1e3a8a)'][i],
                }}
              >
                <div className={`grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-10 ${i === 2 ? 'text-white' : ''}`}>
                  <span
                    className={`font-display grid size-14 place-items-center rounded-full text-xl font-extrabold ${
                      i === 2 ? 'bg-accent text-ink' : 'border-[5px] border-brand bg-white text-ink'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <s.icon aria-hidden className={`size-7 ${i === 2 ? 'text-accent' : 'text-brand-strong'}`} />
                    <h3 className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">{s.title}</h3>
                    <p className={`mt-2 max-w-xl text-base sm:text-lg ${i === 2 ? 'text-white/90' : 'text-ink'}`}>{s.body}</p>
                    <p className={`mt-3 max-w-xl text-sm ${i === 2 ? 'text-white/70' : 'text-ink-soft'}`}>{s.detail}</p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="reveal mt-10 grid items-center gap-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-tint to-accent-tint p-6 shadow-card ring-1 ring-white sm:grid-cols-[1fr_auto] sm:p-8">
          <div>
            <p className="font-hand text-2xl text-brand-strong">got the paperwork?</p>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">Snap an application form, get a checklist</h2>
            <p className="mt-2 max-w-xl text-sm text-ink-soft">
              Upload a PDF or photo. It's read on your device, then Gemma turns the text you approve into a list of what to
              bring and do. Your photo never leaves your phone.
            </p>
          </div>
          <button
            type="button"
            onClick={onSnap}
            {...magneticHandlers()}
            className="magnetic sheen inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-dusk px-5 py-3 font-bold text-white hover:bg-ink active:scale-[0.98]"
          >
            <Camera aria-hidden className="size-5" />
            Snap a form
          </button>
        </div>

        <p className="reveal mt-6 max-w-2xl text-sm text-ink-soft">
          Estimates only. Each property decides who qualifies. We never rank by neighborhood, schools, or who lives there.
        </p>
      </section>
    </div>
  )
}
