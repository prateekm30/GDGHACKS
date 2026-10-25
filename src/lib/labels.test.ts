import { describe, expect, it } from 'vitest'
import { programLabel, sourceName } from './labels'
import type { Building } from './types'

const mk = (x: Partial<Building>) => ({ program: 'LIHTC', incomeCeiling: 60, ...x }) as Building

describe('program labels name the public list, never a made-up program', () => {
  it('labels each source', () => {
    expect(programLabel(mk({ program: 'HUD' }))).toBe('HUD-assisted')
    expect(programLabel(mk({}))).toBe('Tax credit · 60% tier')
    expect(programLabel(mk({ program: 'HUD', subsidy: 'public-housing' }))).toBe('Public housing')
    expect(programLabel(mk({ subsidy: 'dc', incomeCeiling: 80 }))).toBe('DC covenant · up to 80% MFI')
    expect(programLabel(mk({ subsidy: 'usda', program: 'HUD' }))).toMatch(/USDA/)
    expect(sourceName(mk({ subsidy: 'md' }))).toMatch(/Maryland/)
  })
})
