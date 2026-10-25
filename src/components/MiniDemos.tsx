import { Check, Phone, Train } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { lihtcRentCeiling } from '../lib/eligibility'
import type { Building, IncomeLimits } from '../lib/types'
import { TileView } from './BuildingPhoto'

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/** Step 1: drag the income, watch the limit check and the rent cap move. The numbers are the real 2026 limits. */
export function IncomeDemo({ limits }: { limits: IncomeLimits }) {
  const [income, setIncome] = useState(52000)
  const [people, setPeople] = useState(1)
  const id = useId()
  const limit60 = limits.mtsp['60'][people - 1] ?? 0
  const limit50 = limits.mtsp['50'][people - 1] ?? 0
  const under = income <= limit60 ? (income <= limit50 ? 'under 50%' : 'under 60%') : 'over'
  const cap = lihtcRentCeiling(limits, under === 'under 50%' ? 50 : 60, Math.max(0, people - 1))
  const share = Math.round((income / 12) * 0.3)
  const pct = Math.min(100, Math.round((income / (limit60 * 1.3)) * 100))

  return (
    <div className="glass-card mt-5 grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor={id} className="text-sm font-semibold text-white/80">
            Try it: yearly income, {people} {people === 1 ? 'person' : 'people'}
          </label>
          <span className="font-display text-2xl font-extrabold tabular-nums text-white">{money(income)}</span>
        </div>
        <input
          id={id}
          type="range"
          min={15000}
          max={120000}
          step={500}
          value={income}
          onChange={(e) => setIncome(Number(e.target.value))}
          className="demo-range mt-2 w-full"
          aria-valuetext={`${money(income)} a year`}
        />
        <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-white/15">
          <span className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
          <span aria-hidden className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${Math.round((limit60 / (limit60 * 1.3)) * 100)}%` }} />
        </div>
        <p className="mt-2 text-sm text-white/85" aria-live="polite">
          {under === 'over' ? (
            <>
              Over the 60% limit of <b className="text-white">{money(limit60)}</b> for {people}. Some income-based buildings may still work.
            </>
          ) : (
            <>
              You appear to be {under} of the limit ({money(limit60)}). A {people === 1 ? 'studio or 1BR' : `${people - 1}BR`} would be capped near{' '}
              <b className="text-white">{money(cap)}/mo</b>; 30% of your income is {money(share)}.
            </>
          )}
        </p>
      </div>
      <div className="flex gap-1 sm:flex-col" role="group" aria-label="Household size">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={people === n}
            onClick={() => setPeople(n)}
            className={`grid size-10 place-items-center rounded-xl text-sm font-bold transition ${
              people === n ? 'bg-accent text-ink shadow' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {n}
            <span className="sr-only"> {n === 1 ? 'person' : 'people'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

type Lesson = { tag: string; text: string }
const LESSONS: Record<'left' | 'right', Lesson>[] = [
  { left: { tag: 'Lower rent', text: 'You went for the lower rent cap.' }, right: { tag: 'Near Metro', text: 'You chose the shorter walk to Metro.' } },
  { left: { tag: 'Newer', text: 'You picked the newer building.' }, right: { tag: 'Bigger', text: 'You picked the one with more homes.' } },
  { left: { tag: 'Income-based', text: 'You like rent that follows your income.' }, right: { tag: 'Fixed cap', text: 'You prefer a fixed rent cap.' } },
]

/** Step 2: a working two-card pick. Click one, see what it learned, get the next pair. */
export function PickDemo({ buildings, limits }: { buildings: Building[] | null; limits: IncomeLimits }) {
  const pairs = useMemo(() => {
    const pool = (buildings ?? []).filter((b) => !b.sample && !b.seniorOnly && !b.disabilityOnly && b.bedrooms.includes(1))
    const cheap = pool.filter((b) => b.program === 'LIHTC' && b.incomeCeiling === 50).slice(0, 3)
    const metro = pool.filter((b) => b.program === 'LIHTC' && (b.metroMiles ?? 9) < 0.4).slice(0, 3)
    const newer = pool.filter((b) => (b.yearPlacedInService ?? 0) >= 2018).slice(0, 3)
    const big = pool.filter((b) => (b.totalUnits ?? 0) >= 200).slice(0, 3)
    const hud = pool.filter((b) => b.program === 'HUD').slice(0, 3)
    const fixed = pool.filter((b) => b.program === 'LIHTC' && b.incomeCeiling === 60).slice(3, 6)
    const row = (a: Building[], b: Building[]) => (a[0] && b[0] && a[0].id !== b[0].id ? ([a[0], b[0]] as const) : null)
    return [row(cheap, metro), row(newer, big), row(hud, fixed)]
  }, [buildings])
  const [round, setRound] = useState(0)
  const [chosen, setChosen] = useState<'left' | 'right' | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [failed, setFailed] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!chosen) return
    const t = window.setTimeout(() => {
      setChosen(null)
      setRound((r) => (r + 1) % pairs.length)
    }, 1500)
    return () => window.clearTimeout(t)
  }, [chosen, pairs.length])

  const pair = pairs[round] ?? pairs.find(Boolean) ?? null

  function choose(side: 'left' | 'right') {
    if (chosen) return
    setChosen(side)
    setLesson(LESSONS[round]?.[side] ?? null)
  }

  function line(b: Building) {
    if (b.program === 'HUD') return 'Rent follows income'
    return `1BR cap ${money(lihtcRentCeiling(limits, b.incomeCeiling === 50 ? 50 : 60, 1))}`
  }

  return (
    <div className="mt-5">
      <p className="text-sm font-semibold text-white/80">Try a round. These are two real buildings.</p>
      <div className="relative mt-2 grid grid-cols-2 gap-3">
        {pair ? (
          (['left', 'right'] as const).map((side, k) => {
            const b = pair[k]!
            const state = chosen ? (chosen === side ? 'picked' : 'dropped') : ''
            return (
              <button
                key={b.id + round}
                type="button"
                onClick={() => choose(side)}
                aria-label={`Pick ${b.name}, ${b.city}: ${line(b)}`}
                className={`demo-card group relative overflow-hidden rounded-2xl bg-white/10 p-3 text-left ring-1 ring-white/15 transition hover:bg-white/15 ${state} ${k === 0 ? 'in-left' : 'in-right'}`}
              >
                <span className="relative block h-16 overflow-hidden rounded-xl" style={{ background: `linear-gradient(135deg, ${k === 0 ? '#cf2f6a' : '#c2185b'}, ${k === 0 ? '#9d6bff' : '#ffac6b'})` }}>
                  {!failed.has(b.id) && <TileView b={b} layer="imagery" zoom={17} className="" onFail={() => setFailed((s) => new Set(s).add(b.id))} />}
                </span>
                <span className="mt-2 block truncate text-sm font-bold text-white">{b.name}</span>
                <span className="block truncate text-xs text-white/75">{b.city}</span>
                <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-accent">
                  {b.program === 'HUD' ? <Phone aria-hidden className="size-3" /> : <Train aria-hidden className="size-3" />}
                  {line(b)}
                  {b.metroMiles !== null && b.metroMiles < 0.5 ? ' · by Metro' : ''}
                </span>
                {chosen === side && (
                  <span className="pop absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-accent text-ink">
                    <Check aria-hidden className="size-4" />
                  </span>
                )}
              </button>
            )
          })
        ) : (
          <div className="skeleton col-span-2 h-32 rounded-2xl opacity-40" />
        )}
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-9 grid size-8 -translate-x-1/2 place-items-center rounded-full bg-white text-xs font-extrabold text-ink shadow">
          or
        </span>
      </div>
      <p className="mt-3 min-h-6 text-sm text-white/85" aria-live="polite">
        {lesson ? (
          <span className="rise-in inline-flex items-center gap-2">
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-ink">Learned: {lesson.tag}</span>
            {lesson.text}
          </span>
        ) : (
          <span className="text-white/60">Click a card. Each pick nudges the ranking.</span>
        )}
      </p>
    </div>
  )
}

/** Step 3: the shortlist, with the bars that grow as the step scrolls in. Hover a row to see why it ranks. */
export function ShortlistDemo({ buildings }: { buildings: Building[] | null }) {
  const rows = useMemo(() => {
    const pool = (buildings ?? []).filter((b) => !b.sample && !b.seniorOnly && !b.disabilityOnly && b.program === 'LIHTC')
    return pool.slice(10, 13).map((b, i) => ({
      b,
      score: [96, 88, 81][i] ?? 75,
      why: ['Lowest rent cap near Metro', 'Newer, 1BR available', 'Most homes, income averaging'][i] ?? '',
    }))
  }, [buildings])
  const [hover, setHover] = useState<number | null>(null)
  return (
    <ol className="mt-5 space-y-2">
      {rows.length === 0 && <li className="skeleton h-24 rounded-2xl opacity-40" />}
      {rows.map((r, i) => (
        <li
          key={r.b.id}
          onPointerEnter={() => setHover(i)}
          onPointerLeave={() => setHover(null)}
          className={`glass-card grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 transition ${hover === i ? 'bg-white/20' : ''} ${i === 0 ? 'glow-border' : ''}`}
        >
          <span className="grid size-8 place-items-center rounded-full bg-accent font-display text-sm font-extrabold text-ink">{i + 1}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{r.b.name}</p>
            <p className="truncate text-xs text-white/75">{hover === i ? r.why : `${r.b.city}, ${r.b.state}`}</p>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/15">
              <span className="grow-x block h-full rounded-full bg-accent" style={{ width: `${r.score}%`, animationDelay: `${200 + i * 120}ms` }} />
            </span>
          </div>
          <span className="font-display text-lg font-extrabold tabular-nums text-white">{r.score}</span>
        </li>
      ))}
    </ol>
  )
}
