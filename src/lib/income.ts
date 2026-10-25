import { lihtcRentCeiling } from './eligibility'
import type { IncomeLimits } from './types'

export type IncomePeriod = 'year' | 'month'

/** Yearly income of a monthly amount, and back. Monthly is what students and hourly workers know. */
export const toYearly = (n: number, period: IncomePeriod) => (period === 'month' ? n * 12 : n)
export const fromYearly = (yearly: number, period: IncomePeriod) => (period === 'month' ? Math.round(yearly / 12) : yearly)

/**
 * The lowest yearly income that makes sense here, from the data: a year of the cheapest capped rent in the
 * region (a studio at the 50% tier). Below it a "yearly" number is almost always a monthly one typed in the
 * wrong box, so the slider starts here and the form offers to switch. Income-based HUD homes take any income,
 * so it is a nudge, not a wall.
 */
export function incomeFloor(limits: IncomeLimits): number {
  return Math.floor((lihtcRentCeiling(limits, 50, 0) * 12) / 1000) * 1000
}

/** Slider range per period. Yearly tops out at $150k; monthly is the same range divided by 12. */
export function sliderRange(limits: IncomeLimits, period: IncomePeriod): { min: number; max: number; step: number } {
  const floor = incomeFloor(limits)
  return period === 'month' ? { min: Math.floor(floor / 12 / 100) * 100, max: 12500, step: 100 } : { min: floor, max: 150000, step: 1000 }
}

/**
 * Read a yearly income the way people type it: "52,000", "$52,000.00", "52000.75", "52k", "1.5K".
 * Cents are dropped. Anything that is not a number is null.
 */
export function parseIncome(raw: string): number | null {
  const s = raw.replace(/[\s$,]/g, '').toLowerCase()
  const m = s.match(/^(\d+(?:\.\d+)?)(k)?/)
  if (!m) return null
  let n = Number(m[1])
  if (m[2]) n *= 1000
  n = Math.floor(n)
  return n > 0 && Number.isFinite(n) ? n : null
}
