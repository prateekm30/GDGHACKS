import { describe, expect, it } from 'vitest'
import { assess } from './eligibility'
import limits from '../data/limits.2026.json'
import { incomeBasedHeadline } from './price'
import type { Building, IncomeLimits, Situation } from './types'

const hud = {
  id: 'hud-1', name: 'Test', address: '1 Main St', city: 'Frederick', state: 'MD', zip: '21701', area: 'FREDERICK', lat: 39.4, lon: -77.4,
  program: 'HUD', totalUnits: 10, affordableUnits: 10, incomeCeiling: null, bedrooms: [1], unitMix: { '1': 10 }, yearPlacedInService: 2000,
  seniorOnly: false, disabilityOnly: false, metroMiles: null, metroStation: null, marketRent: { '1': 1670 },
  contact: { name: null, org: null, phone: null, email: null }, source: { dataset: 'x', url: 'x', retrieved: 'x' },
} as unknown as Building
const L = limits as unknown as IncomeLimits
const situation: Situation = { householdSize: 1, income: 50000, bedroomsNeeded: null, allFullTimeStudents: false, includeSeniorDisability: false, voucher: false }

describe('income-based price headline', () => {
  it('leads with the typical rent nearby when no income was given, never a bare "30% of income"', () => {
    const h = incomeBasedHeadline(assess(hud, L, null), hud)
    expect(h.label).toBe('Typical rent nearby (HUD)')
    expect(h.value).toBe('$1,670')
    expect(h.isMarket).toBe(true)
    expect(h.note).toMatch(/30% of your income/)
  })
  it('shows 30% of the entered income in dollars once income is known', () => {
    const h = incomeBasedHeadline(assess(hud, L, situation), hud)
    expect(h.value).toBe('$1,250')
    expect(h.per).toBe(true)
    expect(h.label).toBe("What you'd pay")
  })
  it('falls back to the rule when neither income nor a market rent is known', () => {
    const bare = { ...hud, marketRent: undefined } as Building
    const h = incomeBasedHeadline(assess(bare, L, null), bare)
    expect(h.value).toBe('30% of income')
    expect(h.label).toBe('Rent set by your income')
  })
})
