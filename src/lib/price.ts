import type { Assessment } from './eligibility'
import type { Building } from './types'

export interface PriceHeadline {
  label: string
  value: string
  /** Append "/mo" to the value. */
  per: boolean
  note: string
  /** The headline already is the typical rent nearby, so do not repeat it underneath. */
  isMarket: boolean
}

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

/** HUD's typical rent nearby (Small Area FMR) for the unit size the estimate used. */
export function marketRentFor(b: Pick<Building, 'marketRent'>, bedrooms: number | null): number | null {
  const v = b.marketRent?.[String(Math.min(bedrooms ?? 1, 4))]
  return typeof v === 'number' && v > 0 ? v : null
}

/**
 * The big number on an income-based (HUD-assisted) card. With an income: 30% of it, in dollars. Without one
 * there is no number of yours to show, so the typical rent nearby leads and the 30% rule is the footnote.
 * Never "30% of income" as a headline on its own: it reads like a stale figure.
 */
export function incomeBasedHeadline(a: Assessment, b: Pick<Building, 'marketRent'>): PriceHeadline {
  const c = a.cost
  if (c.monthly !== null) {
    return {
      label: "What you'd pay",
      value: money(c.monthly),
      per: true,
      note: 'Estimate: 30% of the income you entered. The property sets the real rent from your adjusted income after deductions.',
      isMarket: false,
    }
  }
  const market = marketRentFor(b, c.bedrooms)
  if (market !== null) {
    return {
      label: 'Typical rent nearby (HUD)',
      value: money(market),
      per: true,
      note: 'Here your rent would be set at about 30% of your income, not this number.',
      isMarket: true,
    }
  }
  return {
    label: 'Rent set by your income',
    value: '30% of income',
    per: false,
    note: 'The property sets rent at about 30% of your adjusted income.',
    isMarket: false,
  }
}
