import { describe, expect, it } from 'vitest'
import { parseIncome } from './income'

describe('income parsing reads what people type', () => {
  it.each([
    ['52000', 52000],
    ['52,000', 52000],
    ['$52,000', 52000],
    ['$52,000.00', 52000],
    ['52,000.75', 52000],
    ['52000.9', 52000],
    ['52k', 52000],
    ['1.5K', 1500],
    [' 48 500 ', 48500],
    ['', null],
    ['abc', null],
    ['0', null],
    ['$', null],
  ])('"%s" is %s', (text, want) => {
    expect(parseIncome(text)).toBe(want)
  })
})

import { streetViewLocation, usableAddress } from './streetview'

describe('street view asks by address, not by HUD coordinates', () => {
  const b = { address: '1330 7th St NW', city: 'Washington', state: 'DC', zip: '20001', lat: 38.9076, lon: -77.022 }
  it('uses the street address when it has a number and a street', () => {
    expect(streetViewLocation(b)).toBe('1330 7th St NW, Washington, DC 20001')
    expect(streetViewLocation({ ...b, address: '2549 Elvans Rd SE Apt 204' })).toBe('2549 Elvans Rd SE, Washington, DC 20001')
  })
  it('looks at the coordinates when the index says the address is wrong (an office or shopping center)', () => {
    expect(streetViewLocation(b, 'c')).toBe('38.907600,-77.022000')
    expect(streetViewLocation(b, 'a')).toBe('1330 7th St NW, Washington, DC 20001')
  })
  it('falls back to coordinates for addresses Google cannot place', () => {
    expect(usableAddress('Lot 3 On Noble Way')).toBe(false)
    expect(usableAddress('Scattered Sites')).toBe(false)
    expect(streetViewLocation({ ...b, address: 'Lot 3 On Noble Way' })).toBe('38.907600,-77.022000')
  })
})

describe('income period and floor', async () => {
  const { incomeFloor, sliderRange, toYearly, fromYearly } = await import('./income')
  const limits = (await import('../data/limits.2026.json')).default as import('./types').IncomeLimits
  it('floors at a year of the cheapest capped rent, rounded to $1,000', () => {
    const floor = incomeFloor(limits)
    expect(floor % 1000).toBe(0)
    expect(floor).toBeGreaterThan(10000)
    expect(floor).toBeLessThan(30000)
    expect(floor).toBe(17000) // 2026: 50% studio cap $1,454 x 12 = $17,448
  })
  it('monthly slider is the yearly one divided by 12', () => {
    expect(sliderRange(limits, 'year')).toEqual({ min: 17000, max: 150000, step: 1000 })
    expect(sliderRange(limits, 'month')).toEqual({ min: 1400, max: 12500, step: 100 })
  })
  it('converts between monthly and yearly', () => {
    expect(toYearly(4300, 'month')).toBe(51600)
    expect(toYearly(51600, 'year')).toBe(51600)
    expect(fromYearly(51600, 'month')).toBe(4300)
  })
})

describe('hero reel picks', async () => {
  const { pickReel } = await import('../components/HeroReel')
  const mk = (id: string, area: string) =>
    ({ id, area, bedrooms: [1], sample: false, seniorOnly: false, disabilityOnly: false }) as unknown as import('./types').Building
  const buildings = [mk('a1', 'DC'), mk('a2', 'DC'), mk('a3', 'DC'), mk('b1', 'ARLINGTON'), mk('b2', 'ARLINGTON')]
  it('uses only trusted street photos in areas that have them, once the index is loaded', () => {
    const reel = pickReel(buildings, { a1: 'a', a2: 'n', a3: 'c', b1: 'n', b2: 'n' })
    const dc = reel.filter((b) => b.area === 'DC').map((b) => b.id)
    expect(dc).toEqual(['a1'])
    // Arlington has no trusted photo, so it stays in the tour with the aerial view.
    expect(reel.some((b) => b.area === 'ARLINGTON')).toBe(true)
  })
  it('tours every area from the air before the index arrives', () => {
    const reel = pickReel(buildings)
    expect(new Set(reel.map((b) => b.area)).size).toBe(2)
  })
})

describe('income edge cases', async () => {
  const { incomeProblem } = await import('./income')
  const { sanitizeBasics } = await import('../components/BasicsForm')
  it('rejects text that is not a whole number', () => {
    for (const bad of ['99999999999999999999', '1e9', '-500', 'abc', '52000abc', 'NaN', 'Infinity', '0', '$', '1.2.3']) expect(parseIncome(bad)).toBeNull()
  })
  it('flags incomes too large to be real', () => {
    expect(incomeProblem(parseIncome('999999999999'), 'year')).toMatch(/1,000,000/)
    expect(incomeProblem(90000, 'month')).toMatch(/83,333/)
    expect(incomeProblem(52000, 'year')).toBeNull()
    expect(incomeProblem(4300, 'month')).toBeNull()
  })
  it('cleans saved answers someone edited by hand', () => {
    expect(sanitizeBasics(null)).toBeNull()
    expect(sanitizeBasics('x')).toBeNull()
    const b = sanitizeBasics({ householdSize: 99, income: 1e20, bedroomsNeeded: -1, priorities: ['cost', 'evil', 'cost', 'metro', 'size', 'newer'], workHub: '<script>', voucher: 'yes', hideOverLimit: true })!
    expect(b.householdSize).toBe(1)
    expect(b.income).toBeNull()
    expect(b.bedroomsNeeded).toBeNull()
    expect(b.priorities).toEqual(['cost', 'metro', 'size'])
    expect(b.workHub).toBeNull()
    expect(b.voucher).toBe(false)
    expect(b.hideOverLimit).toBe(false)
    expect(sanitizeBasics({ householdSize: 3, income: 52000, incomePeriod: 'month', bedroomsNeeded: 2, priorities: ['cost'] })).toMatchObject({ householdSize: 3, income: 52000, incomePeriod: 'month', bedroomsNeeded: 2 })
  })
})
