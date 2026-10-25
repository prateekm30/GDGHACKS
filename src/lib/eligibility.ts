import type { Building, IncomeLimits, Situation } from './types'

/** Share of income spent on rent, as a whole percent. */
export type BurdenLevel = 'ok' | 'stretch' | 'heavy'

export interface CostEstimate {
  kind: 'ceiling' | 'income-based' | 'unknown'
  /** Monthly dollars: the LIHTC gross-rent ceiling, or ~30% of income for HUD-assisted units. */
  monthly: number | null
  bedrooms: number | null
  /** Percent of the user's income, when income is known. */
  burdenPct: number | null
  level: BurdenLevel | null
  /** True when the 60% ceiling was assumed because the data had none. */
  assumedCeiling: boolean
}

/** 'maybe': over the usual limit for HUD-assisted buildings (50% of median) but some admit up to 80%. */
export type LimitStatus = 'under' | 'maybe' | 'over' | 'varies' | 'unknown'

/** HUD's low-income (80%) limit is about 1.5x the very-low (50%) limit in this metro, where the 80% limit is capped. */
const HUD_UPPER_MULTIPLE = 1.5

export interface Assessment {
  limit: LimitStatus
  /** The income cap that was compared, if any. */
  limitAmount: number | null
  cost: CostEstimate
  /** Income is under 2.5x the estimated rent (a common minimum-income rule). */
  belowTypicalMinimum: boolean
  studentRuleMayApply: boolean
  /** Restrictions may have ended (placed in service 30+ years ago). */
  oldRestrictions: boolean
}

const MIN_INCOME_MULTIPLE = 2.5
const OLD_BUILDING_YEARS = 30

function limitFor(table: number[], householdSize: number): number {
  const i = Math.min(Math.max(householdSize, 1), table.length) - 1
  return table.at(i) as number
}

/** HUD imputes 1.5 people per bedroom and 1 person for a studio when setting LIHTC rents. */
export function imputedLimit(table: number[], bedrooms: number): number {
  if (bedrooms <= 0) return limitFor(table, 1)
  const people = 1.5 * bedrooms
  const lo = Math.floor(people)
  if (lo === people) return limitFor(table, lo)
  return (limitFor(table, lo) + limitFor(table, lo + 1)) / 2
}

/** Max monthly gross rent (rent plus utilities) for a LIHTC unit at a ceiling. */
export function lihtcRentCeiling(limits: IncomeLimits, ceiling: 50 | 60, bedrooms: number): number {
  const table = ceiling === 50 ? limits.mtsp['50'] : limits.mtsp['60']
  return Math.round((imputedLimit(table, bedrooms) * 0.3) / 12)
}

/** Percent of AMI, using 100% AMI = 2x the 50% (very low income) limit. Approximate. */
export function amiPercent(limits: IncomeLimits, income: number, householdSize: number): number {
  const median = limitFor(limits.mtsp['50'], householdSize) * 2
  return Math.round((income / median) * 100)
}

export function burdenLevel(pct: number): BurdenLevel {
  if (pct <= 30) return 'ok'
  if (pct <= 40) return 'stretch'
  return 'heavy'
}

/**
 * Smallest bedroom count in the building that fits: what the person asked for, or else about 2 people per
 * bedroom. A one-person household that wants a 2BR is priced on the 2BR.
 */
export function bedroomsFor(building: Building, householdSize: number, bedroomsNeeded: number | null = null): number | null {
  const needed = bedroomsNeeded ?? (householdSize <= 1 ? 0 : Math.ceil(householdSize / 2))
  const sizes = [...building.bedrooms].sort((a, b) => a - b)
  if (sizes.length === 0) return Math.max(needed, 1)
  return sizes.find((b) => b >= needed) ?? null
}

/** The ceiling rent for each bedroom size the building has, so cards show how this building's rents step up. */
export function rentTable(building: Building, limits: IncomeLimits): { bedrooms: number; monthly: number }[] {
  if (building.program !== 'LIHTC' || building.incomeCeiling === 'avg') return []
  const ceiling = building.incomeCeiling ?? 60
  const sizes = building.bedrooms.length ? [...building.bedrooms].sort((a, b) => a - b) : [0, 1, 2, 3]
  return sizes.map((n) => ({ bedrooms: n, monthly: lihtcRentCeiling(limits, ceiling, n) }))
}

export function estimateCost(
  building: Building,
  limits: IncomeLimits,
  situation: Situation | null,
): CostEstimate {
  const householdSize = situation?.householdSize ?? 1
  const bedrooms = bedroomsFor(building, householdSize, situation?.bedroomsNeeded ?? null)

  if (building.program === 'HUD') {
    if (!situation) return { kind: 'income-based', monthly: null, bedrooms, burdenPct: 30, level: 'ok', assumedCeiling: false }
    return {
      kind: 'income-based',
      monthly: Math.round((situation.income * 0.3) / 12),
      bedrooms,
      burdenPct: 30,
      level: 'ok',
      assumedCeiling: false,
    }
  }

  if (building.incomeCeiling === 'avg' || bedrooms === null) {
    return { kind: 'unknown', monthly: null, bedrooms, burdenPct: null, level: null, assumedCeiling: false }
  }

  const ceiling = building.incomeCeiling ?? 60
  const monthly = lihtcRentCeiling(limits, ceiling, bedrooms)
  const burdenPct = situation && situation.income > 0 ? Math.round(((monthly * 12) / situation.income) * 100) : null
  return {
    kind: 'ceiling',
    monthly,
    bedrooms,
    burdenPct,
    level: burdenPct === null ? null : burdenLevel(burdenPct),
    assumedCeiling: building.incomeCeiling === null,
  }
}

export function assess(
  building: Building,
  limits: IncomeLimits,
  situation: Situation | null,
  currentYear = new Date().getFullYear(),
): Assessment {
  const cost = estimateCost(building, limits, situation)
  let limit: LimitStatus = 'unknown'
  let limitAmount: number | null = null

  if (situation) {
    if (building.program === 'LIHTC') {
      if (building.incomeCeiling === 'avg') {
        limit = 'varies'
      } else {
        const ceiling = building.incomeCeiling ?? 60
        limitAmount = limitFor(ceiling === 50 ? limits.mtsp['50'] : limits.mtsp['60'], situation.householdSize)
        limit = situation.income <= limitAmount ? 'under' : 'over'
      }
    } else if (limits.section8) {
      // HUD programs vary. Most HUD-assisted buildings admit under the very-low-income (50%) limit, and some
      // go up to the low-income (80%) limit. Between the two is "maybe": ask the property.
      limitAmount = limitFor(limits.section8['50'], situation.householdSize)
      limit = situation.income <= limitAmount ? 'under' : situation.income <= limitAmount * HUD_UPPER_MULTIPLE ? 'maybe' : 'over'
    }
  }

  const belowTypicalMinimum =
    !!situation && !situation.voucher && cost.kind === 'ceiling' && cost.monthly !== null && situation.income < cost.monthly * 12 * MIN_INCOME_MULTIPLE

  return {
    limit,
    limitAmount,
    cost,
    belowTypicalMinimum,
    studentRuleMayApply: !!situation?.allFullTimeStudents,
    oldRestrictions:
      building.yearPlacedInService !== null && currentYear - building.yearPlacedInService >= OLD_BUILDING_YEARS,
  }
}

/** Buildings the user should see at all, given the senior/disability toggle. Group homes and tiny sites never show. */
export function isVisible(building: Building, situation: Pick<Situation, 'includeSeniorDisability'> | null): boolean {
  if (building.groupHome || (building.totalUnits !== null && building.totalUnits <= 3)) return false
  if (building.seniorOnly || building.disabilityOnly) return !!situation?.includeSeniorDisability
  return true
}
