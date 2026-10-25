// Shared helpers for the Vercel functions. Files starting with _ are not deployed as routes.
import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { findBannedPhrase } from '../shared/bannedPhrases.js'

export const MAX_TEXT_BYTES = 20_000

/** GEMINI_API_KEY, or GOOGLE_API_KEY (the other name Google's SDK reads). Trimmed: pasted keys often carry spaces. */
export function apiKey(): string | undefined {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim() || undefined
}

let client: GoogleGenAI | null = null
function ai(): GoogleGenAI {
  const key = apiKey()
  if (!key) throw new HttpError(503, 'The AI service is not set up yet.')
  client ??= new GoogleGenAI({ apiKey: key })
  return client
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export function errorResponse(e: unknown): Response {
  if (e instanceof RateLimited) {
    const res = json({ error: e.message }, 429)
    res.headers.set('Retry-After', String(e.retryAfterSec))
    return res
  }
  if (e instanceof HttpError) return json({ error: e.message }, e.status)
  // Never log request content; only the error kind.
  console.error('api error', (e as Error)?.name)
  return json({ error: 'The AI service is unavailable. Try again in a minute.' }, 502)
}

// Rate limits. Each serverless instance keeps its own counters, so this slows abuse rather than stopping it;
// the hard ceiling is the Gemini API quota and budget alert set in Google AI Studio. Three windows:
// per IP per minute, per IP per day, and all callers per hour on this instance.
const LIMITS = { perIpMinute: 6, perIpDay: 40, allHour: 120 }
const hits = new Map<string, number[]>()
let allHits: number[] = []
export class RateLimited extends HttpError {
  constructor(public retryAfterSec: number, message: string) {
    super(429, message)
  }
}
export function rateLimit(request: Request, now = Date.now()) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const mine = (hits.get(ip) ?? []).filter((t) => now - t < 86_400_000)
  const lastMinute = mine.filter((t) => now - t < 60_000)
  allHits = allHits.filter((t) => now - t < 3_600_000)
  if (lastMinute.length >= LIMITS.perIpMinute) throw new RateLimited(60, 'Too many requests. Wait a minute and try again.')
  if (mine.length >= LIMITS.perIpDay) throw new RateLimited(3600, 'Daily limit reached for this connection. Try again tomorrow.')
  if (allHits.length >= LIMITS.allHour) throw new RateLimited(600, 'The AI service is busy. Try again in a few minutes.')
  mine.push(now)
  hits.set(ip, mine)
  allHits.push(now)
  // Keep memory bounded if many addresses show up.
  if (hits.size > 5_000) hits.clear()
}
/** For tests. */
export function resetRateLimit() {
  hits.clear()
  allHits = []
}

export async function readJson<T>(request: Request): Promise<T> {
  const raw = await request.text()
  if (raw.length > MAX_TEXT_BYTES + 1_000) throw new HttpError(413, 'That text is too long. Send one page at a time.')
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new HttpError(400, 'Bad request.')
  }
}

// Per-model time limits, so the primary plus the fallback still finish inside the function's 60s.
const TIMEOUTS_MS = [25_000, 25_000]

/** Ask Gemma for JSON. Tries the primary model, then the fallback. Logs timing and error kind, never content. */
export async function askJson<T>(prompt: string): Promise<T> {
  const models = [process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it', process.env.GEMMA_FALLBACK_MODEL || 'gemma-4-31b-it']
  let lastError: unknown
  for (const [i, model] of models.entries()) {
    const started = Date.now()
    try {
      const res = await ai().models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0,
          maxOutputTokens: 1500,
          // Extraction does not need long reasoning; minimal thinking keeps it fast and cheap.
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          abortSignal: AbortSignal.timeout(TIMEOUTS_MS[i] ?? 20_000),
        },
      })
      console.log('gemma ok', model, `${Date.now() - started}ms`)
      return parseJson<T>(res.text ?? '')
    } catch (e) {
      if (e instanceof HttpError) throw e
      console.error('gemma failed', model, `${Date.now() - started}ms`, (e as Error)?.name, String((e as Error)?.message).slice(0, 120))
      lastError = e
    }
  }
  throw lastError
}

function parseJson<T>(text: string): T {
  const start = text.search(/[[{]/)
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (start < 0 || end < start) throw new Error('No JSON in model output')
  return JSON.parse(text.slice(start, end + 1)) as T
}

/** Drop any string that uses wording we never show (e.g. "you qualify"). */
export function isClean(...parts: string[]): boolean {
  return parts.every((p) => !findBannedPhrase(p))
}
