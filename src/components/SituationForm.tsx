import { useId, useState } from 'react'
import type { Situation } from '../lib/types'
import { Button } from './ui'

export function SituationForm({
  initial,
  onSave,
  onSkip,
}: {
  initial: Situation | null
  onSave: (s: Situation) => void
  onSkip?: () => void
}) {
  const id = useId()
  const [income, setIncome] = useState(initial ? String(initial.income) : '')
  const [size, setSize] = useState(initial?.householdSize ?? 1)
  const [students, setStudents] = useState(initial?.allFullTimeStudents ?? false)
  const [senior, setSenior] = useState(initial?.includeSeniorDisability ?? false)
  const incomeNum = Number(income.replace(/[^\d]/g, ''))
  const valid = incomeNum > 0

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ income: incomeNum, householdSize: size, allFullTimeStudents: students, includeSeniorDisability: senior })
      }}
    >
      <div>
        <h2 className="text-lg font-semibold">See what you'd pay</h2>
        <p className="text-sm text-ink-soft">This stays on your device. We never send your income anywhere.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium" htmlFor={`${id}-income`}>
          Yearly household income, before taxes
          <div className="mt-1 flex items-center rounded-xl border border-line bg-surface px-3 focus-within:border-brand">
            <span className="text-ink-soft">$</span>
            <input
              id={`${id}-income`}
              inputMode="numeric"
              autoComplete="off"
              className="w-full bg-transparent px-2 py-2.5 outline-none"
              placeholder="52,000"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </div>
        </label>
        <label className="block text-sm font-medium" htmlFor={`${id}-size`}>
          People in your household
          <select
            id={`${id}-size`}
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-brand" checked={students} onChange={(e) => setStudents(e.target.checked)} />
        <span>
          Everyone in my household is a full-time student
          <span className="block text-ink-soft">
            Some buildings have student rules. Exceptions include single parents, married couples, job-training programs, TANF, and former foster youth.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-brand" checked={senior} onChange={(e) => setSenior(e.target.checked)} />
        <span>Include buildings for seniors (62+) or people with disabilities</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!valid}>
          Show my estimates
        </Button>
        {onSkip && (
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
        )}
      </div>
    </form>
  )
}
