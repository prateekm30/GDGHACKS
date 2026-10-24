// GET /api/health -> { ok, ai } . Says whether the AI key is configured, never the key itself.
export function GET(): Response {
  return Response.json({ ok: true, ai: !!process.env.GEMINI_API_KEY, model: process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it' })
}
