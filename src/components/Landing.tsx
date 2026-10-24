import { ArrowRight, Landmark, Sparkles, Trees, type LucideIcon } from 'lucide-react'
import type { Area, Building } from '../lib/types'
import { BuildingPhoto } from './BuildingPhoto'

export type AreaChoice = Area | 'BOTH'

const AREA_OPTIONS: { value: AreaChoice; title: string; hint: string; icon: LucideIcon }[] = [
  { value: 'DC', title: 'Washington, DC', hint: 'All eight wards', icon: Landmark },
  { value: 'ARLINGTON', title: 'Arlington, VA', hint: 'Arlington County', icon: Trees },
  { value: 'BOTH', title: 'Both', hint: 'Show me everything', icon: Sparkles },
]

const STEPS = [
  { title: 'Tell us the basics', body: 'Household size, bedrooms, and what matters most. Income is optional.' },
  { title: 'Pick this or that', body: 'Eight quick choices between two real buildings. Each pick teaches it what you like.' },
  { title: 'Get your shortlist', body: 'Your top matches, what you might pay, who to call, and what to bring.' },
]

/** Two tilted mini cards with real buildings, as a preview of the picker. Decorative. */
function PickPreview({ pair }: { pair: [Building, Building] }) {
  return (
    <div aria-hidden className="relative mx-auto h-72 w-full max-w-md select-none sm:h-80">
      {pair.map((b, i) => (
        <div
          key={b.id}
          className={`absolute top-4 w-[58%] overflow-hidden rounded-card border border-line bg-surface shadow-lift ${
            i === 0 ? 'left-0 -rotate-6' : 'right-0 top-12 rotate-6'
          }`}
        >
          <BuildingPhoto b={b} className="h-32 sm:h-36" />
          <div className="space-y-1.5 p-3">
            <p className="truncate text-sm font-semibold">{b.name}</p>
            <p className="truncate text-xs text-ink-soft">{b.area === 'DC' ? 'Washington, DC' : 'Arlington, VA'}</p>
            <span className="inline-flex rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-brand-strong">
              {b.program === 'HUD' ? 'Income-based rent' : 'Tax credit'}
            </span>
          </div>
        </div>
      ))}
      <span className="font-display absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-lg font-extrabold text-ink shadow-lift ring-4 ring-canvas">
        or
      </span>
    </div>
  )
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
  return (
    <div className="space-y-16 py-2 sm:py-6">
      <section aria-labelledby="start-heading" className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink-soft">
            <span aria-hidden className="size-2 rounded-full bg-ok" />
            For first-time renters in DC and Arlington
          </span>
          <h1 id="start-heading" className="text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Find a home you can afford, <span className="text-brand">one pick at a time.</span>
          </h1>
          <p className="max-w-xl text-lg text-ink-soft">
            Compare real income-restricted buildings two at a time. HomePick learns what you care about, estimates what
            you'd pay, and hands you a shortlist with next steps.
          </p>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink-soft" style={{ fontFamily: 'var(--font-sans)', letterSpacing: 0 }}>
              Where do you want to live?
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {AREA_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onBegin(o.value)}
                  className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lift active:scale-[0.98] sm:flex-col sm:items-start"
                >
                  <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-canvas text-brand transition group-hover:bg-brand-tint">
                    <o.icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{o.title}</span>
                    <span className="text-sm text-ink-soft">{o.hint}</span>
                  </span>
                  <ArrowRight aria-hidden className="ml-auto size-5 text-brand transition group-hover:translate-x-1 sm:hidden" />
                </button>
              ))}
            </div>
          </div>

          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            <li>
              <strong className="text-ink">{count || '300+'}</strong> real buildings from HUD
            </li>
            <li>
              <strong className="text-ink">2026</strong> income limits
            </li>
            <li>
              <strong className="text-ink">0</strong> sign-ups. Answers stay on your device
            </li>
          </ul>
        </div>

        {preview && <PickPreview pair={preview} />}
      </section>

      <section aria-labelledby="how-heading" className="space-y-5">
        <h2 id="how-heading" className="text-2xl font-bold">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-card border border-line bg-surface p-5 shadow-card">
              <span className="font-display grid size-9 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="max-w-2xl text-xs text-ink-soft">
          Estimates only. Each property decides who qualifies. We never rank by neighborhood, schools, or who lives there.
        </p>
      </section>
    </div>
  )
}
