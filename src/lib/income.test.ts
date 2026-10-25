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
