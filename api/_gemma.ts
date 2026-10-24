// Shared helpers for the Vercel functions. Files starting with _ are not deployed as routes.
import { GoogleGenAI } from '@google/genai'
import { findBannedPhrase } from '../shared/bannedPhrases'

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
  if (e instanceof HttpError) return json({ error: e.message }, e.status)
  // Never log request content; only the error kind.
  console.error('api error', (e as Error)?.name)
  return json({ error: 'The AI service is unavailable. Try again in a minute.' }, 502)
}

// Best effort only: each serverless instance has its own memory. Enough to stop a runaway demo loop.
const hits = new Map<string, number[]>()
export function rateLimit(request: Request, perMinute = 10) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= perMinute) throw new HttpError(429, 'Too many requests. Wait a minute and try again.')
  recent.push(now)
  hits.set(ip, recent)
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

/** Ask Gemma for JSON. Tries the primary model, then the fallback. */
export async function askJson<T>(prompt: string): Promise<T> {
  const models = [process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it', process.env.GEMMA_FALLBACK_MODEL || 'gemma-4-31b-it']
  let lastError: unknown
  for (const model of models) {
    try {
      const res = await ai().models.generateContent({ model, contents: prompt, config: { temperature: 0 } })
      return parseJson<T>(res.text ?? '')
    } catch (e) {
      if (e instanceof HttpError) throw e
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
