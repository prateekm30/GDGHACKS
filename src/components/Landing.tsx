import { ArrowRight, MapPinned, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import type { CSSProperties, PointerEvent } from 'react'
import { prefersReducedMotion, useReveal } from '../lib/motion'
import type { Area, Building } from '../lib/types'
import { BuildingPhoto } from './BuildingPhoto'
import { Skyline } from './Skyline'

export type AreaChoice = Area | 'BOTH'

// Each area gets a Metro line color, like a station sign.
const AREA_OPTIONS: { value: AreaChoice; title: string; hint: string; line: string }[] = [
  { value: 'DC', title: 'Washington, DC', hint: 'All eight wards', line: '#bf0d3e' },
  { value: 'ARLINGTON', title: 'Arlington, VA', hint: 'Arlington County', line: '#009cde' },
  { value: 'BOTH', title: 'Both', hint: 'Show me everything', line: '#ed8b00' },
]

const STEPS: { title: string; body: string; icon: LucideIcon }[] = [
  { title: 'Tell us the basics', body: 'Household size, bedrooms, and what matters most. Income is optional.', icon: ShieldCheck },
  { title: 'Pick this or that', body: 'Eight quick choices between two real buildings. Each pick teaches it what you like.', icon: Sparkles },
  { title: 'Get your shortlist', body: 'Your top matches, what you might pay, who to call, and what to bring.', icon: MapPinned },
]

const HEADLINE = ['Find', 'a', 'home', 'you', 'can', 'afford,']
const HEADLINE_2 = ['one', 'pick', 'at', 'a', 'time.']

/** Two floating mini cards with real buildings, as a preview of the picker. Decorative. */
function PickPreview({ pair }: { pair: [Building, Building] }) {
  return (
    <div aria-hidden className="relative mx-auto hidden h-80 w-full max-w-md select-none lg:block">
      {pair.map((b, i) => (
        <div
          key={b.id}
          className={`absolute w-[60%] ${i === 0 ? 'float left-0 top-6' : 'float-late right-0 top-16'}`}
          style={{ '--r': i === 0 ? '-6deg' : '5deg' } as CSSProperties}
        >
          <div className="overflow-hidden rounded-card border-4 border-white bg-surface shadow-lift">
            <BuildingPhoto b={b} className="h-32" />
            <div className="space-y-1.5 p-3">
              <p className="truncate text-sm font-semibold">{b.name}</p>
              <p className="truncate text-xs text-ink-soft">{b.area === 'DC' ? 'Washington, DC' : 'Arlington, VA'}</p>
              <span className="inline-flex rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-brand-strong">
                {b.program === 'HUD' ? 'Income-based rent' : 'Tax credit'}
              </span>
            </div>
          </div>
        </div>
      ))}
      <span className="wiggle font-display absolute left-1/2 top-[18%] grid size-16 place-items-center rounded-full bg-accent text-xl font-extrabold text-ink shadow-lift ring-4 ring-white">
        or
      </span>
      <span className="font-hand absolute -bottom-2 right-6 rotate-[-4deg] text-2xl text-dusk">which one feels like home?</span>
    </div>
  )
}

/** Moves the sun and clouds a little with the pointer, for depth. */
function parallax(e: PointerEvent<HTMLElement>) {
  if (e.pointerType === 'touch' || prefersReducedMotion()) return
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
  e.currentTarget.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
}

export function Landing({
  onBegin,
  count,
  preview,
}: {
  onBegin: (a: AreaChoice) => void
  count: number
  preview: [Building, Building] | null
}) {
  const revealRef = useReveal<HTMLDivElement>()
  let n = 0

  return (
    <div ref={revealRef}>
      <section
        aria-labelledby="start-heading"
        onPointerMove={parallax}
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #ffe3b0 0%, #ffc1a8 38%, #ffa3c4 68%, #d7b8ff 100%)' }}
      >
        {/* Sun and clouds */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute -right-16 -top-6 opacity-80 transition-transform sm:right-[8%] sm:top-[14%] sm:opacity-100 duration-500 ease-out"
            style={{ transform: 'translate(calc(var(--px, 0) * -30px), calc(var(--py, 0) * -20px))' }}
          >
            <svg viewBox="0 0 200 200" className="sun-rise size-40 sm:size-72">
              <circle cx="100" cy="100" r="96" fill="#fff3b0" className="sun-glow" />
              <circle cx="100" cy="100" r="62" fill="#ffc53d" />
              <circle cx="100" cy="100" r="62" fill="url(#sunshade)" />
              <defs>
                <radialGradient id="sunshade" cx="0.35" cy="0.35">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#ff9f43" stopOpacity="0.4" />
                </radialGradient>
              </defs>
            </svg>
          </div>
          <div
            className="absolute inset-x-0 top-[8%] transition-transform duration-700 ease-out"
            style={{ transform: 'translate(calc(var(--px, 0) * 24px), 0)' }}
          >
            <svg viewBox="0 0 120 40" className="drift absolute w-40 opacity-90">
              <path d="M10 32a12 12 0 0 1 8-21 16 16 0 0 1 30-4 13 13 0 0 1 22 6 10 10 0 0 1 4 19z" fill="#fff" />
            </svg>
            <svg viewBox="0 0 120 40" className="drift-slow absolute top-24 w-28 opacity-80">
              <path d="M10 32a12 12 0 0 1 8-21 16 16 0 0 1 30-4 13 13 0 0 1 22 6 10 10 0 0 1 4 19z" fill="#fff" />
            </svg>
          </div>
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-48 pt-10 sm:pb-64 sm:pt-16 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-6">
            <span className="rise-in inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm backdrop-blur">
              <span aria-hidden className="metro-stripe h-2 w-8 rounded-full" />
              For first-time renters in DC and Arlington
            </span>
            <h1 id="start-heading" className="text-5xl font-extrabold leading-[0.98] text-ink sm:text-7xl">
              {HEADLINE.map((w) => (
                <span key={`a-${w}`} className="word relative mr-[0.22em]" style={{ animationDelay: `${n++ * 70}ms` }}>
                  {w}
                  {w === 'afford,' && (
                    <svg aria-hidden viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-[92%] sm:h-4">
                      <path d="M3 14 C 50 4, 120 4, 197 10" pathLength={1} fill="none" stroke="#d6264a" strokeWidth="6" strokeLinecap="round" className="draw" />
                    </svg>
                  )}
                </span>
              ))}
              <span className="text-brand">
                {HEADLINE_2.map((w) => (
                  <span key={`b-${w}-${n}`} className="word mr-[0.22em]" style={{ animationDelay: `${n++ * 70}ms` }}>
                    {w}
                  </span>
                ))}
              </span>
            </h1>
            <p className="rise-in max-w-xl text-lg text-ink" style={{ animationDelay: '700ms' }}>
              Compare real income-restricted buildings two at a time. HomePick learns what you care about, estimates what
              you'd pay, and hands you a shortlist with next steps.
            </p>

            <div className="rise-in" style={{ animationDelay: '850ms' }}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink" style={{ fontFamily: 'var(--font-sans)', letterSpacing: 0 }}>
                Where do you want to live?
                <span aria-hidden className="font-hand rotate-[-3deg] text-xl font-bold text-brand-strong">
                  pick one to start!
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {AREA_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onBegin(o.value)}
                    className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border-2 border-white bg-white/90 p-4 text-left shadow-card backdrop-blur transition duration-200 hover:-translate-y-1 hover:shadow-lift active:scale-[0.97] sm:flex-col sm:items-start"
                  >
                    <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: o.line }} />
                    <span
                      aria-hidden
                      className="grid size-10 shrink-0 place-items-center rounded-full border-[5px] bg-white transition-transform duration-300 group-hover:scale-110"
                      style={{ borderColor: o.line }}
                    />
                    <span>
                      <span className="block font-display text-lg font-bold leading-tight">{o.title}</span>
                      <span className="text-sm text-ink-soft">{o.hint}</span>
                    </span>
                    <ArrowRight aria-hidden className="ml-auto size-5 text-brand transition-transform duration-200 group-hover:translate-x-1 sm:absolute sm:right-4 sm:top-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {preview && <PickPreview pair={preview} />}
        </div>

        <Skyline className="absolute inset-x-0 bottom-0 h-44 w-full sm:h-60" />
      </section>

      <div aria-hidden className="metro-stripe h-2" />

      <section className="bg-dusk text-white">
        <ul className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
          {[
            { big: String(count || '300+'), small: 'real buildings from HUD data', color: '#ffc53d' },
            { big: '2026', small: 'income limits, checked against the source', color: '#3fd0a4' },
            { big: '0', small: 'sign-ups. Your answers stay on your device', color: '#ff8fb1' },
          ].map((s, i) => (
            <li key={s.small} className="reveal" style={{ '--d': `${i * 120}ms` } as CSSProperties}>
              <span className="font-display block text-5xl font-extrabold" style={{ color: s.color }}>
                {s.big}
              </span>
              <span className="text-sm text-white/85">{s.small}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-heading" className="mx-auto max-w-6xl space-y-8 px-4 py-16">
        <div className="reveal flex flex-wrap items-end justify-between gap-2">
          <h2 id="how-heading" className="text-3xl font-extrabold sm:text-4xl">
            How it works
          </h2>
          <span className="font-hand text-2xl text-brand-strong">three stops, about two minutes</span>
        </div>
        {/* Steps as stations on a Metro line */}
        <ol className="relative grid gap-6 sm:grid-cols-3">
          <span aria-hidden className="absolute left-5 top-5 h-[calc(100%-2.5rem)] w-1.5 rounded-full bg-brand sm:left-5 sm:right-5 sm:h-1.5 sm:w-auto" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="reveal relative pl-16 sm:pl-0 sm:pt-16" style={{ '--d': `${i * 140}ms` } as CSSProperties}>
              <span className="font-display absolute left-0 top-0 grid size-11 place-items-center rounded-full border-[5px] border-brand bg-white text-base font-extrabold text-ink">
                {i + 1}
              </span>
              <div className="rounded-card border border-line bg-surface p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                <s.icon aria-hidden className="size-6 text-brand" />
                <h3 className="mt-3 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="reveal max-w-2xl text-sm text-ink-soft">
          Estimates only. Each property decides who qualifies. We never rank by neighborhood, schools, or who lives there.
        </p>
      </section>
    </div>
  )
}
