import {
  ArrowRight,
  BedDouble,
  Briefcase,
  Building2,
  Check,
  Home,
  Minus,
  Plus,
  Scale,
  Sparkles,
  TrainFront,
  TreePine,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { HUBS } from '../lib/areas'
import type { Feature } from '../lib/ranking'
import type { IncomeLimits, Situation } from '../lib/types'
import { money } from './ui'

export interface Basics {
  householdSize: number
  /** null when the person skipped income: no cost estimates, picks still work. */
  income: number | null
  bedroomsNeeded: number | null
  priorities: Feature[]
  allFullTimeStudents: boolean
  includeSeniorDisability: boolean
  /** A hub id from HUBS, for "close to work or school". */
  workHub?: string | null
  voucher?: boolean
  hideOverLimit?: boolean
}

export const toSituation = (b: Basics): Situation | null =>
  b.income
    ? {
        income: b.income,
        householdSize: b.householdSize,
        allFullTimeStudents: b.allFullTimeStudents,
        includeSeniorDisability: b.includeSeniorDisability,
        voucher: !!b.voucher,
      }
    : null

const PRIORITY_OPTIONS: { value: Feature; label: string; icon: LucideIcon; color: string }[] = [
  { value: 'cost', label: 'Lowest rent', icon: Wallet, color: '#bfdbfe' },
  { value: 'incomeBased', label: 'Rent based on my income', icon: Scale, color: '#a5f0e6' },
  { value: 'metro', label: 'Close to Metro', icon: TrainFront, color: '#c7d2fe' },
  { value: 'commute', label: 'Close to work or school', icon: Briefcase, color: '#bae6fd' },
  { value: 'bedrooms', label: 'More bedrooms', icon: BedDouble, color: '#a5c8fd' },
  { value: 'newer', label: 'Newer building', icon: Sparkles, color: '#b9c4fb' },
  { value: 'cozy', label: 'Smaller, quieter building', icon: TreePine, color: '#a8ecf0' },
  { value: 'size', label: 'Big community, more openings', icon: Building2, color: '#cfe0fb' },
]
const MAX_PRIORITIES = 3
const PEOPLE_COLORS = ['#2453c9', '#0e7490', '#4338ca', '#0891b2', '#1e3a8a', '#3b82f6', '#0f766e', '#4f46e5']

const BEDROOM_OPTIONS: { value: number | null; label: string; beds: number }[] = [
  { value: null, label: 'Any', beds: 0 },
  { value: 0, label: 'Studio', beds: 0 },
  { value: 1, label: '1 bedroom', beds: 1 },
  { value: 2, label: '2 bedrooms', beds: 2 },
  { value: 3, label: '3 or more', beds: 3 },
]

function Question({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="flex items-baseline gap-2 text-base font-bold">
        <span aria-hidden className="font-hand text-2xl leading-none text-brand-strong">
          {n}.
        </span>
        {title}
      </legend>
      {hint && <p className="-mt-1 text-sm text-ink-soft">{hint}</p>}
      {children}
    </fieldset>
  )
}

/** A switch that is a real checkbox underneath. */
function Toggle({ checked, onChange, children, hint }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl p-3 text-sm transition hover:bg-white/60 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand">
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-brand' : 'bg-ink-soft/40'}`}
      >
        <span
          className={`absolute top-0.5 grid size-5 place-items-center rounded-full bg-white shadow transition-transform duration-300 ease-[cubic-bezier(.2,.9,.3,1.4)] ${
            checked ? 'translate-x-5.5' : 'translate-x-0.5'
          }`}
        >
          {checked && <Check className="size-3 text-brand" strokeWidth={3.5} />}
        </span>
      </span>
      <span>
        <span className="font-semibold">{children}</span>
        {hint && <span className="mt-0.5 block text-ink-soft">{hint}</span>}
      </span>
    </label>
  )
}

export function BasicsForm({ initial, onDone, limits }: { initial: Basics | null; onDone: (b: Basics) => void; limits: IncomeLimits }) {
  const id = useId()
  const [size, setSize] = useState(initial?.householdSize ?? 1)
  const [income, setIncome] = useState(initial?.income ? String(initial.income) : '')
  const [bedrooms, setBedrooms] = useState<number | null>(initial?.bedroomsNeeded ?? null)
  const [priorities, setPriorities] = useState<Feature[]>(initial?.priorities ?? ['cost'])
  const [students, setStudents] = useState(initial?.allFullTimeStudents ?? false)
  const [senior, setSenior] = useState(initial?.includeSeniorDisability ?? false)
  const [hub, setHub] = useState<string>(initial?.workHub ?? '')
  const [voucher, setVoucher] = useState(initial?.voucher ?? false)
  const [hideOver, setHideOver] = useState(initial?.hideOverLimit ?? false)
  const incomeNum = Number(income.replace(/[^\d]/g, '')) || null
  const limit60 = limits.mtsp['60'][Math.min(size, 8) - 1] ?? 0
  const limit50 = limits.mtsp['50'][Math.min(size, 8) - 1] ?? 0

  function toggle(f: Feature) {
    setPriorities((p) => (p.includes(f) ? p.filter((x) => x !== f) : p.length < MAX_PRIORITIES ? [...p, f] : p))
  }

  return (
    <form
      className="grid gap-8 lg:grid-cols-[1fr_20rem]"
      onSubmit={(e) => {
        e.preventDefault()
        onDone({
          householdSize: size,
          income: incomeNum,
          bedroomsNeeded: bedrooms,
          priorities,
          allFullTimeStudents: students,
          includeSeniorDisability: senior,
          workHub: hub || null,
          voucher,
          hideOverLimit: hideOver && !!incomeNum,
        })
      }}
    >
      <div className="space-y-9">
        <div>
          <p className="font-hand text-2xl text-brand-strong">let's get to know you</p>
          <h1 id="basics-heading" className="text-3xl font-extrabold sm:text-4xl">
            First, the basics
          </h1>
          <p className="mt-1 text-sm text-ink-soft">About a minute. Everything stays on this device.</p>
        </div>

        <Question n={1} title="Who's moving in, including you?">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 rounded-full bg-white/70 p-1 shadow-card">
              <button
                type="button"
                aria-label="Fewer people"
                disabled={size <= 1}
                onClick={() => setSize((s) => Math.max(1, s - 1))}
                className="grid size-11 place-items-center rounded-full bg-canvas text-ink transition hover:bg-brand-tint active:scale-90 disabled:opacity-40"
              >
                <Minus aria-hidden className="size-5" />
              </button>
              <output aria-live="polite" className="font-display w-20 text-center text-2xl font-extrabold">
                {size === 8 ? '8+' : size}
                <span className="sr-only">{size === 1 ? ' person' : ' people'}</span>
              </output>
              <button
                type="button"
                aria-label="More people"
                disabled={size >= 8}
                onClick={() => setSize((s) => Math.min(8, s + 1))}
                className="grid size-11 place-items-center rounded-full bg-dusk text-white transition hover:bg-ink active:scale-90 disabled:opacity-40"
              >
                <Plus aria-hidden className="size-5" />
              </button>
            </div>
            <div aria-hidden className="flex flex-wrap gap-0.5">
              {Array.from({ length: size }, (_, i) => (
                <span key={i} className="pop grid size-9 place-items-center rounded-full" style={{ background: PEOPLE_COLORS[i] }}>
                  <User className="size-5 text-white" strokeWidth={2.5} fill="white" />
                </span>
              ))}
            </div>
          </div>
        </Question>

        <Question n={2} title="Yearly household income, before taxes" hint="Optional. With it, we estimate rent and check each building's income limit.">
          <div className="max-w-md space-y-3">
            <div className="flex items-baseline gap-1 border-b-4 border-dashed border-ink/25 pb-1 transition-colors focus-within:border-brand">
              <span aria-hidden className="font-display text-3xl font-extrabold text-ink-soft">
                $
              </span>
              <input
                id={`${id}-income`}
                aria-label="Yearly household income in dollars"
                inputMode="numeric"
                autoComplete="off"
                className="font-display w-full bg-transparent text-4xl font-extrabold outline-none placeholder:text-ink/25"
                placeholder="52,000"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                onBlur={() => incomeNum && setIncome(incomeNum.toLocaleString('en-US'))}
              />
            </div>
            <input
              type="range"
              aria-label="Yearly household income slider"
              min={0}
              max={150000}
              step={1000}
              value={incomeNum ?? 0}
              onChange={(e) => setIncome(Number(e.target.value) ? Number(e.target.value).toLocaleString('en-US') : '')}
              className="w-full accent-brand"
            />
            <p className="text-sm text-ink-soft">
              Most tax-credit homes here take households up to{' '}
              <strong className="text-ink">{money(limit60)}</strong> for {size === 1 ? 'one person' : `${size} people`} (60% of area median), and HUD-assisted
              homes up to <strong className="text-ink">{money(limit50)}</strong>.
            </p>
          </div>
        </Question>

        <Question n={3} title="Bedrooms you need">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {BEDROOM_OPTIONS.map((o) => {
              const on = bedrooms === o.value
              return (
                <label
                  key={o.label}
                  className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center text-sm font-bold transition duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand ${
                    on ? '-translate-y-0.5 border-dusk bg-dusk text-white shadow-lift' : 'border-transparent bg-white/70 hover:-translate-y-0.5 hover:bg-white'
                  }`}
                >
                  <input type="radio" name={`${id}-br`} className="sr-only" checked={on} onChange={() => setBedrooms(o.value)} />
                  <span aria-hidden className="flex h-6 items-center gap-0.5">
                    {o.value === null ? (
                      <Sparkles className="size-5" />
                    ) : o.beds === 0 ? (
                      <Home className="size-5" />
                    ) : (
                      Array.from({ length: o.beds }, (_, i) => <BedDouble key={i} className="size-5" />)
                    )}
                  </span>
                  {o.label}
                </label>
              )
            })}
          </div>
        </Question>

        <Question n={4} title="What matters most?" hint={`Pick up to ${MAX_PRIORITIES}. Your picks on the next screen fine-tune this.`}>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRIORITY_OPTIONS.map((o, i) => {
              const on = priorities.includes(o.value)
              const full = !on && priorities.length >= MAX_PRIORITIES
              return (
                <label
                  key={o.value}
                  className={`relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 text-sm font-bold transition duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand ${
                    on ? 'border-dusk shadow-lift' : 'border-transparent hover:-translate-y-0.5'
                  } ${full ? 'opacity-45' : ''}`}
                  style={{ background: on ? o.color : `${o.color}55`, transform: on ? `rotate(${i % 2 ? 1 : -1}deg)` : undefined }}
                >
                  <input type="checkbox" className="sr-only" checked={on} disabled={full} onChange={() => toggle(o.value)} />
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80">
                    <o.icon className="size-5 text-ink" />
                  </span>
                  {o.label}
                  {on && (
                    <span aria-hidden className="pop absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-dusk text-white">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                </label>
              )
            })}
          </div>
          {(priorities.includes('commute') || hub) && (
            <label className="rise-in mt-2 block max-w-md text-sm font-semibold">
              Where do you work or study?
              <select
                value={hub}
                onChange={(e) => setHub(e.target.value)}
                className="mt-1 block min-h-12 w-full rounded-2xl border-2 border-dusk/15 bg-white/80 px-3 font-semibold outline-none focus:border-brand"
              >
                <option value="">Choose the closest spot</option>
                {HUBS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              {priorities.includes('commute') && !hub && (
                <span className="mt-1 block font-normal text-ink-soft">Pick a spot so we can measure distance.</span>
              )}
            </label>
          )}
        </Question>

        <Question n={5} title="A few more things">
          <div className="space-y-1 rounded-3xl bg-white/45 p-2">
            <Toggle checked={voucher} onChange={setVoucher} hint="We'll show what you'd likely pay with it at tax-credit buildings.">
              I have a Housing Choice Voucher (Section 8)
            </Toggle>
            <Toggle
              checked={hideOver}
              onChange={setHideOver}
              hint={incomeNum ? undefined : 'Needs your income above.'}
            >
              Hide buildings I'm likely over the income limit for
            </Toggle>
            <Toggle checked={senior} onChange={setSenior}>
              Include buildings for seniors (62+) or people with disabilities
            </Toggle>
            <Toggle
              checked={students}
              onChange={setStudents}
              hint="Some buildings have student rules. Exceptions include single parents, married couples, job-training programs, TANF, and former foster youth."
            >
              Everyone in my household is a full-time student
            </Toggle>
          </div>
        </Question>

        <button
          type="submit"
          className="sheen group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-brand px-6 font-display text-lg font-bold text-white shadow-lift transition hover:-translate-y-0.5 hover:bg-brand-strong active:scale-[0.98] sm:w-auto"
        >
          Start picking
          <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      {/* Live summary: decorative restatement of the answers above. */}
      <aside aria-hidden className="hidden lg:block">
        <div className="sticky top-24 space-y-4 rounded-[1.75rem] bg-dusk p-6 text-white shadow-lift">
          <p className="font-hand text-2xl text-accent">your profile</p>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-white/70">Household</p>
            <p key={size} className="bump font-display text-3xl font-extrabold">
              {size === 8 ? '8+' : size} {size === 1 ? 'person' : 'people'}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-white/70">Income</p>
            <p key={incomeNum ?? 0} className="bump font-display text-3xl font-extrabold">
              {incomeNum ? money(incomeNum) : 'Skipped'}
            </p>
            {incomeNum && (
              <p className="mt-1 text-sm text-white/85">
                {incomeNum <= limit60 ? 'Under' : 'Over'} the 60% tax-credit limit · income-based rent would be about{' '}
                {money(Math.round((incomeNum * 0.3) / 12))}/mo
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-white/70">Bedrooms</p>
            <p className="font-display text-xl font-bold">{BEDROOM_OPTIONS.find((o) => o.value === bedrooms)?.label}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-white/70">Matters most</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {priorities.length === 0 && <span className="text-sm text-white/70">Nothing yet</span>}
              {priorities.map((p) => {
                const o = PRIORITY_OPTIONS.find((x) => x.value === p)
                return (
                  <span key={p} className="pop rounded-full px-2.5 py-1 text-xs font-bold text-ink" style={{ background: o?.color }}>
                    {o?.label}
                  </span>
                )
              })}
            </div>
          </div>
          {hub && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white/70">Work or school</p>
              <p className="font-semibold">{HUBS.find((h) => h.id === hub)?.name}</p>
            </div>
          )}
        </div>
      </aside>
    </form>
  )
}
