// The server helpers are plain functions, so they get unit tests without a network.
import { afterEach, describe, expect, it } from 'vitest'
import { errorResponse, isClean, RateLimited, rateLimit, resetRateLimit } from '../../api/_gemma.js'
import { splitText } from './snap'

const req = (ip: string) => new Request('http://x/api/snap-text', { headers: { 'x-forwarded-for': ip } })

describe('rateLimit', () => {
  afterEach(resetRateLimit)

  it('allows ten calls a minute per address, then returns 429 with Retry-After', () => {
    const now = 1_700_000_000_000
    for (let i = 0; i < 10; i++) rateLimit(req('1.1.1.1'), now + i)
    let err: unknown
    try {
      rateLimit(req('1.1.1.1'), now + 10)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(RateLimited)
    const res = errorResponse(err)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  it('keeps addresses separate and frees the minute window', () => {
    const now = 1_700_000_000_000
    for (let i = 0; i < 10; i++) rateLimit(req('1.1.1.1'), now + i)
    expect(() => rateLimit(req('2.2.2.2'), now)).not.toThrow()
    expect(() => rateLimit(req('1.1.1.1'), now + 61_000)).not.toThrow()
  })

  it('caps one address per day', () => {
    const now = 1_700_000_000_000
    for (let i = 0; i < 100; i++) rateLimit(req('3.3.3.3'), now + i * 70_000)
    expect(() => rateLimit(req('3.3.3.3'), now + 101 * 70_000)).toThrow(/Daily limit/)
  })

  it('caps everyone per hour on this instance', () => {
    const now = 1_700_000_000_000
    for (let i = 0; i < 200; i++) rateLimit(req(`10.0.${Math.floor(i / 5)}.${i % 5}`), now + i)
    expect(() => rateLimit(req('9.9.9.9'), now + 200)).toThrow(/busy/)
  })
})

describe('isClean', () => {
  it('drops labels that promise eligibility', () => {
    expect(isClean('Bring two pay stubs')).toBe(true)
    expect(isClean('You qualify for this unit')).toBe(false)
  })
})

describe('splitText', () => {
  it('leaves short text alone', () => {
    expect(splitText('hello world')).toEqual(['hello world'])
  })
  it('splits long text at paragraph breaks under the limit', () => {
    const para = 'Bring your photo ID and two recent pay stubs to the leasing office. '.repeat(40)
    const text = Array.from({ length: 12 }, () => para).join('\n\n')
    const parts = splitText(text, 16_000)
    expect(parts.length).toBeGreaterThan(1)
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(16_000)
    expect(parts.join('\n\n').replace(/\s+/g, ' ').trim()).toBe(text.replace(/\s+/g, ' ').trim())
  })
})
