import { ArrowRight, Camera, MapPinned, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { AREAS } from '../lib/areas'
import { magneticHandlers, useReveal } from '../lib/motion'
import type { Building, IncomeLimits } from '../lib/types'
import { CountUp } from './CountUp'
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


/** Its own page: the numbers at dusk, then the three stops at night, each with a working demo. */
export function HowItWorks({
  buildings,
  limits,
  searchLabel,
  onBegin,
  onSnap,
}: {
  buildings: Building[] | null
  limits: IncomeLimits
  searchLabel: string
  onBegin: () => void
  onSnap: () => void
}) {
  const revealRef = useReveal<HTMLDivElement>()
  const areaNames = AREAS.map((a) => (a.state === 'DC' ? a.name : `${a.name}, ${a.state}`))

  return (
    <div ref={revealRef} className="how">
      <section className="dusk-top relative overflow-hidden pt-20 text-white sm:pt-24">
        <div className="relative mx-auto max-w-6xl px-4 pb-6">
          <p className="eyebrow flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
            <span aria-hidden className="h-px w-10 bg-accent" />
            How it works
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-[1.02] sm:text-6xl">
            Three stops, <span className="text-accent">about two minutes.</span>
          </h1>
          <p className="mt-3 max-w-xl text-white/80">Every step below is live. Try it here, then start for real.</p>
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
              The three stops
            </h2>
            <span className="font-hand text-2xl text-accent">three stops, about two minutes. try each one.</span>
          </div>
          {/* Each step pins while the next one slides over it. The previous card shrinks back as it is covered. */}
          <ol className="mt-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`stack-slot ${i < STEPS.length - 1 ? 'min-h-[60svh]' : ''}`}>
                <div className="stack-card night-card sticky overflow-hidden rounded-card ring-1 ring-white/15" style={{ top: `calc(5.5rem + ${i * 1.25}rem)` }}>
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
        <Skyline night className="relative block h-28 w-full sm:h-36" />
      </section>
    </div>
  )
}
