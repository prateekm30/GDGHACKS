import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestChecklist } from './snap'

const FORM = 'Monthly rent $1,200. Security deposit $1,200 due at signing. Application fee $35. Bring two recent pay stubs and a photo ID.'

afterEach(() => vi.unstubAllGlobals())

describe('checklist request errors are said in plain words', () => {
  it('offline: not the browser\'s "Failed to fetch"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(requestChecklist(FORM)).rejects.toThrow(/Could not reach the checklist service/)
  })
  it('rate limited: wait and retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"Too many requests"}', { status: 429 })))
    await expect(requestChecklist(FORM)).rejects.toThrow(/Too many requests right now/)
  })
  it('server error without JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
    await expect(requestChecklist(FORM)).rejects.toThrow(/unavailable right now/)
  })
  it('a 200 with no items array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"nope":1}', { status: 200 })))
    await expect(requestChecklist(FORM)).rejects.toThrow(/could not read/)
  })
  it('a good answer still works, and made-up items are dropped', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [{ type: 'fee', label: 'Application fee $35', quote: 'Application fee $35' }, { type: 'document', label: 'Birth certificate', quote: 'birth certificate' }] }), { status: 200 }),
      ),
    )
    const r = await requestChecklist(FORM)
    expect(r.items.map((i) => i.label)).toEqual(['Application fee $35'])
    expect(r.failedParts).toBe(0)
  })
})
