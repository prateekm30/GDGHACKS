import { ArrowRight, Ban, Camera, Eye, Landmark, ShieldCheck, Sparkles, Users, type LucideIcon } from 'lucide-react'
import { useReveal } from '../lib/motion'
import type { Building, IncomeLimits } from '../lib/types'
import { CountUp } from './CountUp'
import { Glossary } from './Glossary'
import { Skyline } from './Skyline'
import { money } from './ui'

/** Who built it. */
const TEAM = ['Prateek Malekar', 'Sajjad Irshad', 'Rishik Uppalapati']

const WONT: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Ban, title: 'No scraped listings', body: 'Every building comes from a public dataset with an address and a program. Nothing is lifted from listing sites.' },
  { icon: Camera, title: 'No fake photos', body: 'Street View and aerial imagery of the real address, with attribution, or no photo at all. Never a stock interior.' },
  { icon: Eye, title: 'No ranking on neighborhoods', body: 'Never on safety, schools, or who lives there. Only building facts: rent, bedrooms, Metro distance, size, age.' },
  { icon: ShieldCheck, title: 'Nothing leaves your device', body: 'Income, household, and picks stay in this tab. The only thing that can be sent is form text you choose to review.' },
]

const SOURCES: { name: string; what: string }[] = [
  { name: 'HUD LIHTC database', what: 'tax-credit buildings and their income tiers' },
  { name: 'HUD Multifamily assistance and Section 8 contracts', what: 'HUD-assisted buildings where rent follows income' },
  { name: 'HUD Public Housing Developments', what: 'housing-authority buildings (building facts only)' },
  { name: 'USDA Rural Development multifamily housing', what: 'rural rentals in the outer counties' },
  { name: 'DC DHCD, Maryland DHCD, City of Alexandria', what: 'locally financed and covenant-restricted buildings' },
  { name: 'HUD income limits and Small Area Fair Market Rents', what: '2026 limits for the Washington metro area and the typical rent by ZIP code' },
  { name: 'U.S. Census TIGERweb, Google Street View, Esri imagery', what: 'county outlines and photos of the real addresses' },
]

export function About({ buildings, limits, onBegin, onHow }: { buildings: Building[] | null; limits: IncomeLimits; onBegin: () => void; onHow: () => void }) {
  const revealRef = useReveal<HTMLDivElement>()
  const shown = buildings?.filter((b) => !b.groupHome) ?? null
  const homes = buildings?.reduce((n, b) => n + (b.affordableUnits ?? 0), 0) ?? null
  const one = limits.mtsp['60'][0] ?? 0
  const three = limits.mtsp['60'][2] ?? 0

  return (
    <div ref={revealRef} className="about">
      <section className="dusk-top relative overflow-hidden pt-20 text-white sm:pt-24">
        <div className="relative mx-auto max-w-6xl px-4 pb-8">
          <p className="eyebrow flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
            <span aria-hidden className="h-px w-10 bg-accent" />
            Our goal
          </p>
          <h1 id="about-heading" className="mt-3 max-w-3xl text-4xl font-extrabold leading-[1.02] sm:text-6xl">
            Income-restricted housing, <span className="text-accent">made findable.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">
            Across DC, Maryland, and Virginia, about {homes ? Math.round(homes / 1000).toLocaleString('en-US') : '120'},000 apartments have rents capped or set by income
            because the building took public money. Most of the working people who fit them have never heard the phrase. We built HomePick to change that.
          </p>
        </div>
      </section>

      <section className="dusk relative overflow-hidden text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
          {[
            { n: shown?.length ?? null, label: 'income-restricted buildings you can compare', fmt: (v: number) => v.toLocaleString('en-US') },
            { n: homes, label: 'income-restricted homes inside them', fmt: (v: number) => `about ${Math.round(v / 1000).toLocaleString('en-US')},000` },
            { n: one, label: 'yearly income a single person can earn and still fit most tax-credit homes (60% of area median, 2026)', fmt: money },
          ].map((s) => (
            <div key={s.label} className="reveal">
              <p className="font-display text-4xl font-extrabold text-accent sm:text-5xl">{s.n === null ? '…' : <CountUp value={s.n} duration={1400} format={s.fmt} />}</p>
              <p className="mt-1 max-w-xs text-sm text-white/80">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <section id="what-is-income-restricted" aria-labelledby="what-heading" className="glass-panel reveal scroll-mt-24 p-6 sm:p-10">
          <p className="font-hand text-2xl text-brand-strong">the problem</p>
          <h2 id="what-heading" className="text-3xl font-extrabold sm:text-4xl">
            What “income-restricted” means, and why nobody knows
          </h2>
          <div className="mt-4 grid gap-6 text-base leading-relaxed lg:grid-cols-2">
            <div className="space-y-3">
              <p>
                When a building is financed with tax credits, HUD contracts, or local housing money, it agrees to keep some or all apartments for households
                under an income limit. In return the rent is <strong>capped</strong> (tax-credit buildings) or <strong>set at about 30% of your income</strong>{' '}
                (HUD-assisted buildings). These are ordinary apartment buildings with ordinary leases. There is no lottery ticket, just an income check.
              </p>
              <p>
                The limits are higher than most people guess. In 2026 a single person in the Washington metro area can earn up to{' '}
                <strong>{money(one)}</strong> a year, and a family of three up to <strong>{money(three)}</strong>, and still fit most tax-credit homes. That is a
                teacher, a nurse, a line cook, a first-year analyst.
              </p>
            </div>
            <div className="space-y-3">
              <p>
                The information exists, scattered across HUD spreadsheets, state PDFs, and property websites that never say the word. People who would fit
                sign a market-rate lease at twice the rent, or never apply at all. The ones who do know spend weekends calling leasing offices to ask the same
                three questions.
              </p>
              <p>
                HomePick pulls the public records into one place, asks for your household and income once, shows only buildings you appear to fit, and lets you
                pick between two at a time until it knows what you care about. You leave with a shortlist, the numbers, and who to call.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="wont-heading" className="reveal">
          <div className="mb-4">
            <p className="font-hand text-2xl text-brand-strong">on purpose</p>
            <h2 id="wont-heading" className="text-3xl font-extrabold sm:text-4xl">What it will not do</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {WONT.map((w) => (
              <div key={w.title} className="glass-panel flex gap-4 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-strong">
                  <w.icon aria-hidden className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold">{w.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{w.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="who-heading" className="glass-dark reveal p-6 text-white sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="font-hand text-2xl text-accent">who we are</p>
              <h2 id="who-heading" className="text-3xl font-extrabold sm:text-4xl">Three Man</h2>
              <p className="mt-3 text-white/85">
                HomePick DMV was built at <strong>GDG Build with AI × Hacktoberfest 2026</strong> at Virginia Tech, for the “AI for Housing” track. We are Three Man, a
                team of three Virginia Tech students, and we started because people we know were paying market rent a block from buildings they would have fit.
              </p>
              <ul className="mt-4 space-y-2">
                {TEAM.map((name) => (
                  <li key={name} className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-accent text-ink">
                      <Users aria-hidden className="size-4" />
                    </span>
                    <span className="font-bold">{name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-hand text-2xl text-accent">where the data comes from</p>
              <h2 className="text-2xl font-extrabold">Public records only</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {SOURCES.map((s) => (
                  <li key={s.name} className="flex gap-2">
                    <Landmark aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>
                      <span className="font-semibold">{s.name}</span> <span className="text-white/70">· {s.what}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-white/60">
                Estimates only. Each property decides who qualifies. Income limits {limits.effective}. Not affiliated with HUD or any government.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="words-heading" className="reveal">
          <Glossary />
        </section>

        <div className="reveal flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onBegin} className="sheen group inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-brand px-6 font-display text-lg font-bold text-white shadow-lift transition hover:-translate-y-0.5 hover:bg-brand-strong">
            Check what fits your income
            <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
          </button>
          <button type="button" onClick={onHow} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-white/50 px-6 font-semibold text-ink ring-1 ring-white/70 backdrop-blur transition hover:bg-white/80">
            <Sparkles aria-hidden className="size-4 text-brand-strong" />
            See how it works
          </button>
        </div>
      </div>
      <div aria-hidden className="dusk-fade pt-6">
        <Skyline night className="block h-24 w-full sm:h-32" />
      </div>
    </div>
  )
}
