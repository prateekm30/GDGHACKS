// GET /api/health -> whether the AI key is configured, never the key itself.
// `envNames` lists the NAMES of AI-related variables this deployment can see, to debug a missing key.
import { apiKey } from './_gemma'

export function GET(): Response {
  return Response.json(
    {
      ok: true,
      ai: !!apiKey(),
      model: process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
      env: process.env.VERCEL_ENV ?? 'local',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      envNames: Object.keys(process.env).filter((k) => /gemini|gemma|google/i.test(k)),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
