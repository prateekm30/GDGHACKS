// POST /api/snap-text  { text } -> { items: [{ type, label, quote }], cached? }
// Receives only text the user reviewed and edited. The photo or PDF never leaves the device.
import { DEMO_CHECKLIST, DEMO_FORM_TEXT } from '../shared/demoForm.js'
import { itemLooksRisky, labelFitsText, normText, quoteInText, scamSignals } from '../shared/snapCheck.js'
import { askJson, errorResponse, HttpError, isClean, json, MAX_TEXT_BYTES, rateLimit, readJson } from './_gemma.js'

const TYPES = new Set(['document', 'deadline', 'fee', 'contact'])
const norm = normText

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

/**
 * Keep only items the person can verify: a quote that is really in the text, a label whose numbers, addresses,
 * and words come from the text too (a planted label cannot ride on an honest quote), and no banned wording.
 */
export function checkItems(items: Item[], text: string) {
  return items
    .filter((it) => TYPES.has(it.type) && typeof it.label === 'string' && typeof it.quote === 'string')
    .filter((it) => quoteInText(it.quote, text))
    .filter((it) => isClean(it.label) && labelFitsText(it.label, text))
    .slice(0, 25)
    .map(({ type, label, quote }) => ({ type, label: label.slice(0, 80), quote, risky: itemLooksRisky(label, quote) || undefined }))
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { text } = await readJson<{ text?: unknown }>(request)
    if (typeof text !== 'string' || text.trim().length < 20) throw new HttpError(400, 'Add some text from the form first.')
    if (new TextEncoder().encode(text).length > MAX_TEXT_BYTES) throw new HttpError(413, 'That text is too long. Send one page at a time.')

    if (norm(text) === norm(DEMO_FORM_TEXT)) return json({ items: DEMO_CHECKLIST, cached: true })

    rateLimit(request)
    const out = await askJson<{ items?: Item[] }>(PROMPT(text))
    const items = checkItems(out.items ?? [], text)
    // Scam signals come from the person's own text, by code, so they show even when the model misses them.
    return json({ items, warnings: scamSignals(text) })
  } catch (e) {
    return errorResponse(e)
  }
}
