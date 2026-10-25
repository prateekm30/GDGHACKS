import { describe, expect, it } from 'vitest'
import { AREAS, NEIGHBORS, widenAreas } from './areas'
import type { Area } from './types'

describe('area neighbors', () => {
  it('lists every area, each neighbor is a real area, and touching goes both ways', () => {
    for (const a of AREAS) {
      expect(NEIGHBORS[a.id].length).toBeGreaterThan(0)
      for (const n of NEIGHBORS[a.id]) {
        expect(AREAS.some((x) => x.id === n)).toBe(true)
        expect(NEIGHBORS[n]).toContain(a.id)
      }
    }
  })
})

describe('widenAreas', () => {
  const counts: Partial<Record<Area, number>> = { ARLINGTON: 3, ALEXANDRIA: 4, DC: 40, FAIRFAX: 30 }
  const count = (set: ReadonlySet<Area>) => [...set].reduce((n, a) => n + (counts[a] ?? 0), 0)

  it('leaves an empty selection (all of the DMV) alone', () => {
    expect(widenAreas(new Set(), count, 16)).toEqual({ areas: new Set(), added: [] })
  })
  it('leaves a selection with enough buildings alone', () => {
    const r = widenAreas(new Set<Area>(['DC']), count, 16)
    expect(r.added).toEqual([])
    expect([...r.areas]).toEqual(['DC'])
  })
  it('adds the neighbors, in map order, when the chosen area is short', () => {
    const r = widenAreas(new Set<Area>(['ARLINGTON']), count, 16)
    expect(r.added).toEqual(['DC', 'ALEXANDRIA', 'FAIRFAX'])
    expect(r.areas.has('ARLINGTON')).toBe(true)
    expect(count(r.areas)).toBeGreaterThanOrEqual(16)
  })
  it('keeps growing ring by ring and ends with every area when nothing fits', () => {
    const r = widenAreas(new Set<Area>(['FREDERICK']), () => 0, 16)
    expect(r.areas.size).toBe(AREAS.length)
    expect(r.added).toHaveLength(AREAS.length - 1)
    expect(r.added.slice(0, 2)).toEqual(['MONTGOMERY', 'LOUDOUN'])
  })
})
