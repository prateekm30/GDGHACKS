import { describe, expect, it } from 'vitest'
import limitsJson from '../data/limits.2026.json'
import { findBannedPhrase } from '../../shared/bannedPhrases'
import { amiPercent, assess, burdenLevel, imputedLimit, isVisible, lihtcRentCeiling } from './eligibility'
import { fit, PRIOR } from './ranking'
import type { Building, IncomeLimits, Situation } from './types'

const limits = limitsJson as IncomeLimits

function building(over: Partial<Building> = {}): Building {
  return {
    id: 't1', name: 'Test', address: '1 Test St', city: 'Washington', state: 'DC', zip: '20001', area: 'DC',
    lat: 38.9, lon: -77.0, program: 'LIHTC', totalUnits: 100, affordableUnits: 80, incomeCeiling: 60,
    bedrooms: [0, 1, 2], yearPlacedInService: 2015, seniorOnly: false, disabilityOnly: false, metroMiles: 0.5,
    contact: { name: null, org: null, phone: null, email: null },
    source: { dataset: 'test', url: '', retrieved: '2026-10-24' },
    ...over,
  }
}

const me: Situation = { income: 52000, householdSize: 1, allFullTimeStudents: false, includeSeniorDisability: false }

describe('rent ceilings', () => {
  it('uses 1.5 people per bedroom (1BR = average of 1- and 2-person limits)', () => {
    expect(imputedLimit(limits.mtsp['60'], 1)).toBe((69780 + 79740) / 2)
  })
  it('matches the published 2026 Arlington 60% 1BR rent of $1,869', () => {
    expect(lihtcRentCeiling(limits, 60, 1)).toBe(1869)
  })
  it('uses 1 person for a studio', () => {
    expect(lihtcRentCeiling(limits, 60, 0)).toBe(Math.round((69780 * 0.3) / 12))
  })
})

describe('assess', () => {
  it('is under the 60% limit at $52k for one person', () => {
    const a = assess(building(), limits, me)
    expect(a.limit).toBe('under')
    expect(a.limitAmount).toBe(69780)
  })
  it('is over the limit above $69,780', () => {
    expect(assess(building(), limits, { ...me, income: 70000 }).limit).toBe('over')
  })
  it('uses the building 50% ceiling when the data says so', () => {
    const a = assess(building({ incomeCeiling: 50 }), limits, { ...me, income: 60000 })
    expect(a.limit).toBe('over')
  })
  it('treats income averaging as varies, not 60%', () => {
    const a = assess(building({ incomeCeiling: 'avg' }), limits, me)
    expect(a.limit).toBe('varies')
    expect(a.cost.kind).toBe('unknown')
  })
  it('labels a missing ceiling as assumed 60%', () => {
    expect(assess(building({ incomeCeiling: null }), limits, me).cost.assumedCeiling).toBe(true)
  })
  it('flags income under 2.5x the rent', () => {
    // studio ceiling ~ $1,745/mo -> 2.5x annual ~ $52,350
    expect(assess(building({ bedrooms: [0] }), limits, { ...me, income: 40000 }).belowTypicalMinimum).toBe(true)
    expect(assess(building({ bedrooms: [0] }), limits, { ...me, income: 60000 }).belowTypicalMinimum).toBe(false)
  })
  it('gives HUD-assisted buildings income-based rent at 30%', () => {
    const a = assess(building({ program: 'HUD', incomeCeiling: null }), limits, me)
    expect(a.cost.kind).toBe('income-based')
    expect(a.cost.monthly).toBe(1300)
  })
  it('does not claim a HUD limit when Section 8 limits are not loaded', () => {
    expect(assess(building({ program: 'HUD' }), limits, me).limit).toBe('unknown')
  })
  it('warns on buildings 30+ years old', () => {
    expect(assess(building({ yearPlacedInService: 1990 }), limits, me, 2026).oldRestrictions).toBe(true)
  })
  it('flags the student rule', () => {
    expect(assess(building(), limits, { ...me, allFullTimeStudents: true }).studentRuleMayApply).toBe(true)
  })
})

describe('helpers', () => {
  it('burden thresholds', () => {
    expect(burdenLevel(30)).toBe('ok')
    expect(burdenLevel(35)).toBe('stretch')
    expect(burdenLevel(41)).toBe('heavy')
  })
  it('AMI percent', () => {
    expect(amiPercent(limits, 58150, 1)).toBe(50)
  })
  it('hides senior/disability-only buildings unless toggled', () => {
    expect(isVisible(building({ seniorOnly: true }), me)).toBe(false)
    expect(isVisible(building({ seniorOnly: true }), { ...me, includeSeniorDisability: true })).toBe(true)
  })
})

describe('banned phrases', () => {
  it('blocks eligibility and waitlist claims', () => {
    expect(findBannedPhrase('Good news, you qualify for this unit')).not.toBeNull()
    expect(findBannedPhrase('The waitlist is open now')).not.toBeNull()
    expect(findBannedPhrase('You appear to be under the estimated income limit')).toBeNull()
  })
})

describe('ranking', () => {
  it('learns a metro preference from picks', () => {
    const near = building({ id: 'near', metroMiles: 0.2, incomeCeiling: 60 })
    const far = building({ id: 'far', metroMiles: 2.8, incomeCeiling: 50 })
    const picks = Array.from({ length: 6 }, () => ({ chosen: near, other: far }))
    const w = fit(picks, limits, me)
    expect(w.metro).toBeGreaterThan(PRIOR.metro)
  })
  it('is unchanged when city and ZIP are swapped (no place features)', () => {
    const a = building({ id: 'a', metroMiles: 0.4 })
    const b = building({ id: 'b', metroMiles: 1.9, city: 'Arlington', zip: '22204', state: 'VA', area: 'ARLINGTON' })
    const swappedA = { ...a, city: b.city, zip: b.zip }
    const swappedB = { ...b, city: a.city, zip: a.zip }
    const w1 = fit([{ chosen: a, other: b }], limits, me)
    const w2 = fit([{ chosen: swappedA, other: swappedB }], limits, me)
    expect(w2).toEqual(w1)
  })
})
