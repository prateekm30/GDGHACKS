// POST /api/explain  { term } -> { text }
// Plain-language explainer for housing terms on the cards (LIHTC, AMI, income certification...).
// Takes a term from a fixed list only, so no user data is ever sent here.
import { askJson, errorResponse, HttpError, isClean, json, rateLimit, readJson } from './_gemma'

export const TERMS = ['LIHTC', 'AMI', 'income limit', 'HUD-assisted', 'income certification', 'waitlist', 'Housing Choice Voucher'] as const

export async function POST(request: Request): Promise<Response> {
  try {
    const { term } = await readJson<{ term?: unknown }>(request)
    if (typeof term !== 'string' || !(TERMS as readonly string[]).includes(term)) throw new HttpError(400, 'Unknown term.')
    rateLimit(request, 20)
    const out = await askJson<{ text?: string }>(
      `Explain "${term}" to a first-time renter in the Washington, DC area in 2 short sentences, 8th-grade reading level. ` +
        `Never say anyone qualifies or is approved. Return ONLY JSON: {"text":"..."}`,
    )
    const text = (out.text ?? '').slice(0, 400)
    if (!text || !isClean(text)) throw new HttpError(502, 'No explanation available right now.')
    return json({ text })
  } catch (e) {
    return errorResponse(e)
  }
}
