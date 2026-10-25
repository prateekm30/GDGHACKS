import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { assess } from '../lib/eligibility'
import { programLabel } from '../lib/labels'
import { incomeBasedHeadline } from '../lib/price'
import type { Building, IncomeLimits, Situation } from '../lib/types'
import { addressLine } from './BuildingCard'
import { BuildingPhoto } from './BuildingPhoto'
import { CountUp } from './CountUp'
import { Petals } from './Petals'
import { money } from './ui'

const AUTO_CLOSE_MS = 5200

/** Typical rent nearby for the size the estimate used, when HUD publishes it for the ZIP. */
export function marketFor(b: Building, bedrooms: number | null): number | null {
  const v = b.marketRent?.[String(Math.min(bedrooms ?? 1, 4))]
  return typeof v === 'number' && v > 0 ? v : null
}

/**
 * The curtain before the results: the room goes dark, a spotlight sweeps, and the best match steps into it,
 * name first, then its photo, then what it might cost next to the typical rent nearby. Skippable, auto-closes.
 */
export function SpotlightReveal({ b, limits, situation, onDone }: { b: Building; limits: IncomeLimits; situation: Situation | null; onDone: () => void }) {
  const [closing, setClosing] = useState(false)
  const done = useRef(false)
  const a = assess(b, limits, situation)
  const monthly = a.cost.monthly
  const market = marketFor(b, a.cost.bedrooms)
  const saving = monthly !== null && market !== null && market > monthly ? market - monthly : null
  const ib = a.cost.kind === 'income-based' ? incomeBasedHeadline(a, b) : null
  const words = b.name.split(' ')

  function close() {
    if (done.current) return
    done.current = true
    setClosing(true)
    window.setTimeout(onDone, 520)
  }

  useEffect(() => {
    const t = window.setTimeout(close, AUTO_CLOSE_MS)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      role="dialog"
      aria-label="Revealing your best match"
      className={`stage no-print fixed inset-0 z-[70] flex items-center justify-center overflow-hidden px-4 text-white ${closing ? 'is-out' : ''}`}
      onClick={close}
    >
      <div aria-hidden className="stage-light absolute inset-0" />
      <Petals count={18} />
      <div className="relative mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <p className="stage-hand font-hand text-2xl text-accent sm:text-3xl">and your best match is…</p>
        <h2 className="mt-2 text-balance text-4xl font-extrabold leading-tight sm:text-5xl">
          {words.map((w, i) => (
            <Fragment key={i}>
              <span className="stage-word" style={{ '--i': i } as CSSProperties}>
                {w}
              </span>
              {i < words.length - 1 ? ' ' : ''}
            </Fragment>
          ))}
        </h2>
        <p className="stage-sub mt-2 text-sm text-white/75">
          {addressLine(b)} · {programLabel(b)}
        </p>
        <div className="stage-card mt-6 w-full overflow-hidden rounded-card bg-white/10 shadow-lift ring-1 ring-white/25 backdrop-blur-md">
          <BuildingPhoto b={b} className="h-48 sm:h-60" single />
          <dl className="grid grid-cols-2 gap-3 p-4 text-left sm:grid-cols-3 sm:p-5">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/65">{ib ? ib.label : 'Rent cap'}</dt>
              <dd className="font-display text-2xl font-extrabold tabular-nums sm:text-3xl">
                {monthly !== null ? <CountUp value={monthly} duration={1400} format={money} /> : ib ? ib.value : 'Varies'}
                {(monthly !== null || ib?.per) && <span className="text-sm font-semibold text-white/70">/mo</span>}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/65">{ib?.isMarket ? 'Your rent here' : 'Typical rent nearby'}</dt>
              <dd className={`font-display font-extrabold tabular-nums ${ib?.isMarket ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl'}`}>
                {ib?.isMarket ? '30% of your income' : market !== null ? <CountUp value={market} duration={1400} format={money} /> : 'Not listed'}
                {!ib?.isMarket && market !== null && <span className="text-sm font-semibold text-white/70">/mo</span>}
              </dd>
            </div>
            <div className="col-span-2 rounded-xl bg-accent/90 px-3 py-2 text-ink sm:col-span-1 sm:bg-transparent sm:p-0 sm:text-white">
              <dt className="text-[11px] font-semibold uppercase tracking-wider sm:text-white/65">{saving !== null ? 'You could keep' : 'Income limit'}</dt>
              <dd className="font-display text-2xl font-extrabold tabular-nums sm:text-3xl">
                {saving !== null ? (
                  <>
                    <CountUp value={saving * 12} duration={1600} format={money} />
                    <span className="text-sm font-semibold opacity-80">/yr</span>
                  </>
                ) : a.limitAmount !== null ? (
                  money(a.limitAmount)
                ) : (
                  'Ask'
                )}
              </dd>
            </div>
          </dl>
        </div>
        <button
          type="button"
          onClick={close}
          className="stage-skip mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-ink shadow-lift transition hover:bg-accent"
        >
          See all three matches
        </button>
      </div>
    </div>
  )
}
