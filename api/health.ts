// GET /api/health -> whether the AI and Street View are switched on. Never a key, its length, or its shape.
import { apiKey } from './_gemma.js'

export function GET(): Response {
  return Response.json(
    {
      ok: true,
      ai: !!apiKey(),
      streetView: /^AIza[\w-]{20,}$/.test((process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.VITE_GOOGLE_MAPS_KEY || '').trim()),
      model: process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
      env: process.env.VERCEL_ENV ?? 'local',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
