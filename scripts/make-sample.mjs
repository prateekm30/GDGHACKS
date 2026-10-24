// Writes a FAKE 24-building sample to public/data/buildings.json so the UI can be built
// before the real HUD pipeline runs. Every row has sample: true and an obviously fake name.
import { writeFileSync, mkdirSync } from 'node:fs'

let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const streets = ['Maple', 'Cedar', 'Birch', 'Willow', 'Aspen', 'Juniper', 'Linden', 'Hazel']
const ceilings = [60, 60, 60, 50, 'avg', null]
const bedroomSets = [[0, 1], [1, 2], [0, 1, 2], [1, 2, 3], [2, 3], [0, 1, 2, 3]]

const rows = Array.from({ length: 24 }, (_, i) => {
  const dc = i % 3 !== 2
  const hud = i % 4 === 3
  const total = 20 + Math.floor(rnd() * 280)
  return {
    id: `sample-${String(i + 1).padStart(2, '0')}`,
    name: `Sample ${pick(streets)} ${hud ? 'Homes' : 'Apartments'} ${i + 1}`,
    address: `${100 + i * 7} Example ${pick(streets)} St${dc ? ' NW' : ''}`,
    city: dc ? 'Washington' : 'Arlington',
    state: dc ? 'DC' : 'VA',
    zip: dc ? '20001' : '22204',
    area: dc ? 'DC' : 'ARLINGTON',
    lat: dc ? 38.86 + rnd() * 0.08 : 38.85 + rnd() * 0.05,
    lon: dc ? -77.04 + rnd() * 0.08 : -77.12 + rnd() * 0.06,
    program: hud ? 'HUD' : 'LIHTC',
    totalUnits: total,
    affordableUnits: Math.round(total * (0.4 + rnd() * 0.6)),
    incomeCeiling: hud ? null : pick(ceilings),
    bedrooms: pick(bedroomSets),
    yearPlacedInService: 1988 + Math.floor(rnd() * 36),
    seniorOnly: i === 5 || i === 17,
    disabilityOnly: false,
    metroMiles: Math.round(rnd() * 30) / 10,
    contact: { name: null, org: 'Sample Management Co.', phone: '(202) 555-01' + String(i).padStart(2, '0'), email: null },
    source: { dataset: 'FAKE SAMPLE DATA', url: '', retrieved: '2026-10-24' },
    sample: true,
  }
})

mkdirSync('public/data', { recursive: true })
writeFileSync('public/data/buildings.json', JSON.stringify(rows, null, 2) + '\n')
console.log(`wrote ${rows.length} sample buildings`)
