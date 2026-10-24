import { estimateCost } from './eligibility'
import type { Building, IncomeLimits, Situation } from './types'

/**
 * Pairwise preference model (Bradley-Terry / logistic regression on feature differences).
 * Runs entirely in the browser. Features never include place names or demographics.
 */
export const FEATURES = ['cost', 'incomeBased', 'bedrooms', 'metro', 'newer', 'size'] as const
export type Feature = (typeof FEATURES)[number]
export type Weights = Record<Feature, number>

export const FEATURE_LABELS: Record<Feature, string> = {
  cost: 'Lower cost',
  incomeBased: 'Rent based on your income',
  bedrooms: 'More bedrooms',
  metro: 'Closer to Metro',
  newer: 'Newer building',
  size: 'Bigger building',
}

/** Starting belief: cost matters most. Picks move the weights away from this. */
export const PRIOR: Weights = { cost: 1.5, incomeBased: 0.3, bedrooms: 0.3, metro: 0.6, newer: 0.2, size: 0 }

/** How much a "matters most" choice on the basics step raises a feature's starting weight. */
const PRIORITY_BOOST = 1.2

/** Starting weights from the basics step. Picks still move them from here. */
export function priorFor(priorities: readonly Feature[]): Weights {
  const w = { ...PRIOR }
  for (const f of priorities) w[f] += PRIORITY_BOOST
  return w
}

const LEARNING_RATE = 0.8
const PULL_TO_PRIOR = 0.1
const EPOCHS = 30

export type Vector = Record<Feature, number>

export function features(b: Building, limits: IncomeLimits, situation: Situation | null): Vector {
  const est = estimateCost(b, limits, situation)
  let cost: number
  if (est.burdenPct !== null) cost = 1 - Math.min(est.burdenPct, 60) / 60
  else if (est.monthly !== null) cost = 1 - Math.min(est.monthly, 3000) / 3000
  else cost = b.program === 'HUD' ? 0.6 : 0.4
  return {
    cost,
    incomeBased: b.program === 'HUD' ? 1 : 0,
    bedrooms: Math.min(Math.max(0, ...b.bedrooms, 0), 3) / 3,
    metro: b.metroMiles === null ? 0.5 : 1 - Math.min(b.metroMiles, 3) / 3,
    // Opened 1987 (oldest in the data) = 0, this year = 1. Unknown sits in the middle.
    newer: b.yearPlacedInService === null ? 0.5 : Math.min(Math.max((b.yearPlacedInService - 1987) / 39, 0), 1),
    size: b.totalUnits ? Math.min(Math.log10(b.totalUnits) / 3, 1) : 0.3,
  }
}

function dot(w: Weights, x: Vector): number {
  return FEATURES.reduce((s, f) => s + w[f] * x[f], 0)
}

function diff(a: Vector, b: Vector): Vector {
  return Object.fromEntries(FEATURES.map((f) => [f, a[f] - b[f]])) as Vector
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

export interface Pick {
  chosen: Building
  other: Building
}

/** Refit weights from all picks so far, regularized toward the prior. */
export function fit(picks: Pick[], limits: IncomeLimits, situation: Situation | null, prior: Weights = PRIOR): Weights {
  const w: Weights = { ...prior }
  const diffs = picks.map((p) => diff(features(p.chosen, limits, situation), features(p.other, limits, situation)))
  for (let e = 0; e < EPOCHS; e++) {
    for (const x of diffs) {
      const p = sigmoid(dot(w, x))
      for (const f of FEATURES) w[f] += (LEARNING_RATE / (e + 1)) * ((1 - p) * x[f] - PULL_TO_PRIOR * (w[f] - prior[f]))
    }
  }
  return w
}

export function score(b: Building, w: Weights, limits: IncomeLimits, situation: Situation | null): number {
  return dot(w, features(b, limits, situation))
}

export function rank(buildings: Building[], w: Weights, limits: IncomeLimits, situation: Situation | null): Building[] {
  return [...buildings].sort((a, b) => score(b, w, limits, situation) - score(a, w, limits, situation))
}

/**
 * Next pair to show: among the top candidates not yet seen, a pair that teaches us the most.
 * We want the two buildings to differ a lot (so the pick says something) while the model
 * is unsure which one you'd choose (predicted preference near 50/50).
 */
export function nextPair(
  pool: Building[],
  seen: Set<string>,
  w: Weights,
  limits: IncomeLimits,
  situation: Situation | null,
  perGroup = 4,
): [Building, Building] | null {
  // Candidates: the best few from each program and area, so one kind of building can't crowd out the rest.
  const ranked = rank(pool.filter((b) => !seen.has(b.id)), w, limits, situation)
  const taken = new Map<string, number>()
  const fresh = ranked.filter((b) => {
    const key = `${b.program}-${b.area}`
    const n = taken.get(key) ?? 0
    taken.set(key, n + 1)
    return n < perGroup
  })
  if (fresh.length < 2) return null
  const vecs = fresh.map((b) => features(b, limits, situation))
  let best: [Building, Building] | null = null
  let bestValue = -Infinity
  for (let i = 0; i < fresh.length; i++) {
    for (let j = i + 1; j < fresh.length; j++) {
      const d = diff(vecs.at(i) as Vector, vecs.at(j) as Vector)
      const spread = Math.sqrt(FEATURES.reduce((sum, f) => sum + d[f] * d[f], 0))
      const value = spread - Math.abs(dot(w, d))
      if (value > bestValue) {
        bestValue = value
        best = [fresh.at(i) as Building, fresh.at(j) as Building]
      }
    }
  }
  return best
}

/** Features sorted by learned weight, for the "What we learned about you" panel. */
export function learnedPriorities(w: Weights): { feature: Feature; label: string; weight: number }[] {
  return FEATURES.map((f) => ({ feature: f, label: FEATURE_LABELS[f], weight: w[f] }))
    .filter((p) => p.weight > 0.15)
    .sort((a, b) => b.weight - a.weight)
}

/** Plain-language "why this matches" reasons, written by code from the top features. */
export function whyReasons(b: Building, w: Weights, limits: IncomeLimits, situation: Situation | null): string[] {
  const x = features(b, limits, situation)
  const contributions = FEATURES.map((f) => ({ f, c: w[f] * x[f] })).sort((a, b) => b.c - a.c)
  const out: string[] = []
  for (const { f, c } of contributions) {
    if (c <= 0.1 || out.length >= 2) continue
    if (f === 'cost') out.push('Its estimated cost fits what you picked before')
    if (f === 'incomeBased') out.push('Rent is based on income, so it stays near 30% of yours')
    if (f === 'bedrooms') out.push('It has the larger units you leaned toward')
    if (f === 'metro' && b.metroMiles !== null) out.push(b.metroMiles < 0.15 ? 'Right next to a Metro station' : `About ${b.metroMiles.toFixed(1)} miles from Metro (straight line)`)
    if (f === 'newer' && b.yearPlacedInService !== null) out.push(`Newer building, opened ${b.yearPlacedInService}`)
    if (f === 'size') out.push('It is a larger building, like ones you chose')
  }
  return out
}
