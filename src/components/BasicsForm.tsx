import { BedDouble, Building2, Scale, Sparkles, TrainFront, Wallet, type LucideIcon } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import type { Feature } from '../lib/ranking'
import type { Situation } from '../lib/types'
import { Button } from './ui'

export interface Basics {
  householdSize: number
  /** null when the person skipped income: no cost estimates, picks still work. */
  income: number | null
  bedroomsNeeded: number | null
  priorities: Feature[]
  allFullTimeStudents: boolean
  includeSeniorDisability: boolean
}

export const toSituation = (b: Basics): Situation | null =>
  b.income
    ? {
        income: b.income,
        householdSize: b.householdSize,
        allFullTimeStudents: b.allFullTimeStudents,
        includeSeniorDisability: b.includeSeniorDisability,
      }
    : null

const PRIORITY_OPTIONS: { value: Feature; label: string; icon: LucideIcon }[] = [
  { value: 'cost', label: 'Lowest rent', icon: Wallet },
  { value: 'incomeBased', label: 'Rent based on my income', icon: Scale },
  { value: 'metro', label: 'Close to Metro', icon: TrainFront },
  { value: 'bedrooms', label: 'More bedrooms', icon: BedDouble },
  { value: 'newer', label: 'Newer building', icon: Sparkles },
  { value: 'size', label: 'Bigger community', icon: Building2 },
]
const MAX_PRIORITIES = 3

const BEDROOM_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 0, label: 'Studio' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3+' },
]

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{title}</legend>
      {hint && <p className="-mt-1 text-xs text-ink-soft">{hint}</p>}
      {children}
    </fieldset>
  )
}

const chip = (on: boolean) =>
  `inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand ${
    on ? 'border-brand bg-brand-tint text-brand-strong' : 'border-line bg-surface hover:border-brand'
  }`

export function BasicsForm({ initial, onDone }: { initial: Basics | null; onDone: (b: Basics) => void }) {
  const id = useId()
  const [size, setSize] = useState(initial?.householdSize ?? 1)
  const [income, setIncome] = useState(initial?.income ? String(initial.income) : '')
  const [bedrooms, setBedrooms] = useState<number | null>(initial?.bedroomsNeeded ?? null)
  const [priorities, setPriorities] = useState<Feature[]>(initial?.priorities ?? ['cost'])
  const [students, setStudents] = useState(initial?.allFullTimeStudents ?? false)
  const [senior, setSenior] = useState(initial?.includeSeniorDisability ?? false)
  const incomeNum = Number(income.replace(/[^\d]/g, '')) || null

  function toggle(f: Feature) {
    setPriorities((p) => (p.includes(f) ? p.filter((x) => x !== f) : p.length < MAX_PRIORITIES ? [...p, f] : p))
  }

  return (
    <form
      className="space-y-7"
      onSubmit={(e) => {
        e.preventDefault()
        onDone({
          householdSize: size,
          income: incomeNum,
          bedroomsNeeded: bedrooms,
          priorities,
          allFullTimeStudents: students,
          includeSeniorDisability: senior,
        })
      }}
    >
      <div>
        <h1 id="basics-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
          First, the basics
        </h1>
        <p className="mt-1 text-sm text-ink-soft">Takes 30 seconds. Everything stays on this device.</p>
      </div>

      <Question title="How many people will live with you, including you?">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <label key={n} className={`${chip(size === n)} min-w-11 justify-center`}>
              <input type="radio" name={`${id}-size`} className="sr-only" checked={size === n} onChange={() => setSize(n)} />
              {n === 8 ? '8+' : n}
            </label>
          ))}
        </div>
      </Question>

      <Question title="Yearly household income, before taxes" hint="Optional. With it, we estimate rent and the income limit for each building.">
        <div className="flex max-w-xs items-center rounded-xl border border-line bg-surface px-3 focus-within:border-brand">
          <span className="text-ink-soft" aria-hidden>
            $
          </span>
          <input
            aria-label="Yearly household income in dollars"
            inputMode="numeric"
            autoComplete="off"
            className="w-full bg-transparent px-2 py-2.5 outline-none"
            placeholder="52,000"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
          />
        </div>
      </Question>

      <Question title="Bedrooms you need">
        <div className="flex flex-wrap gap-2">
          {BEDROOM_OPTIONS.map((o) => (
            <label key={o.label} className={`${chip(bedrooms === o.value)} min-w-11 justify-center`}>
              <input
                type="radio"
                name={`${id}-br`}
                className="sr-only"
                checked={bedrooms === o.value}
                onChange={() => setBedrooms(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </Question>

      <Question title="What matters most?" hint={`Pick up to ${MAX_PRIORITIES}. Your picks on the next screen fine-tune this.`}>
        <div className="flex flex-wrap gap-2">
          {PRIORITY_OPTIONS.map((o) => {
            const on = priorities.includes(o.value)
            const full = !on && priorities.length >= MAX_PRIORITIES
            return (
              <label key={o.value} className={`${chip(on)} ${full ? 'opacity-50' : ''}`}>
                <input type="checkbox" className="sr-only" checked={on} disabled={full} onChange={() => toggle(o.value)} />
                <o.icon aria-hidden className="size-4 shrink-0" />
                {o.label}
              </label>
            )
          })}
        </div>
      </Question>

      <div className="space-y-3 rounded-xl bg-canvas p-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-brand" checked={students} onChange={(e) => setStudents(e.target.checked)} />
          <span>
            Everyone in my household is a full-time student
            <span className="block text-ink-soft">
              Some buildings have student rules. Exceptions include single parents, married couples, job-training programs,
              TANF, and former foster youth.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-brand" checked={senior} onChange={(e) => setSenior(e.target.checked)} />
          <span>Include buildings for seniors (62+) or people with disabilities</span>
        </label>
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        Start picking
      </Button>
    </form>
  )
}
