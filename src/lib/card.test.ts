import { describe, expect, it } from 'vitest'
import { addressLine, telHref } from '../components/BuildingCard'

describe('card text', () => {
  it('writes the address line and copes with a missing street address', () => {
    expect(addressLine({ address: '1212 Southern Ave SE', city: 'Washington', state: 'DC', zip: '20032' })).toBe('1212 Southern Ave SE, Washington, DC 20032')
    expect(addressLine({ address: '', city: 'Suitland', state: 'MD', zip: '20746' })).toBe('Suitland, MD 20746 (street address not listed)')
    expect(addressLine({ address: '3102 S 28th St', city: 'Alexandria', state: 'VA', zip: '' })).toBe('3102 S 28th St, Alexandria, VA')
  })
  it('dials the number only and passes an extension the phone understands', () => {
    expect(telHref('(301) 662-0099')).toBe('tel:3016620099')
    expect(telHref('(301) 662-0099 ext. 1632')).toBe('tel:3016620099;ext=1632')
    expect(telHref('(301) 622-4801 or 4803')).toBe('tel:3016224801')
    expect(telHref('529-7730')).toBe('tel:5297730')
  })
})
