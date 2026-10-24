// POST /api/snap-text  { text } -> { items: [{ type, label, quote }], cached? }
// Receives only text the user reviewed and edited. The photo or PDF never leaves the device.
import { DEMO_CHECKLIST, DEMO_FORM_TEXT } from '../shared/demoForm'
import { askJson, errorResponse, HttpError, isClean, json, MAX_TEXT_BYTES, rateLimit, readJson } from './_gemma'

const TYPES = new Set(['document', 'deadline', 'fee', 'contact'])
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

interface Item {
  type: string
  label: string
  quote: string
}

const PROMPT = (text: string) => `You turn a rental application or housing letter into a checklist for the applicant.
Return ONLY a JSON object: {"items":[{"type":"document|deadline|fee|contact","label":"short plain-English task, under 60 characters","quote":"exact words copied from the text"}]}
Rules:
- "quote" must be copied character for character from the text. Do not fix spelling or paraphrase.
- Only include things the applicant must bring, pay, do by a date, or contact.
- Never say whether the person qualifies or is approved.
- If nothing applies, return {"items":[]}.

TEXT:
"""
${text}
"""`

export async function POST(request: Request): Promise<Response> {
  try {
    const { text } = await readJson<{ text?: unknown }>(request)
    if (typeof text !== 'string' || text.trim().length < 20) throw new HttpError(400, 'Add some text from the form first.')
    if (new TextEncoder().encode(text).length > MAX_TEXT_BYTES) throw new HttpError(413, 'That text is too long. Send one page at a time.')

    if (norm(text) === norm(DEMO_FORM_TEXT)) return json({ items: DEMO_CHECKLIST, cached: true })

    rateLimit(request)
    const out = await askJson<{ items?: Item[] }>(PROMPT(text))
    const hay = norm(text)
    const items = (out.items ?? [])
      .filter((it) => TYPES.has(it.type) && typeof it.label === 'string' && typeof it.quote === 'string')
      .filter((it) => it.quote.trim().length >= 4 && hay.includes(norm(it.quote)))
      .filter((it) => isClean(it.label))
      .slice(0, 20)
      .map(({ type, label, quote }) => ({ type, label: label.slice(0, 80), quote }))
    return json({ items })
  } catch (e) {
    return errorResponse(e)
  }
}
