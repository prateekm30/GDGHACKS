// GET /api/health -> whether the AI key is configured, never the key itself.
// `envNames` lists the NAMES of AI-related variables this deployment can see, to debug a missing key.
import { apiKey } from './_gemma.js'

function keyShape(k: string) {
  if (!k) return { set: false }
  return {
    set: true,
    length: k.length,
    startsWithAIza: k.startsWith('AIza'),
    hasQuotesOrSpaces: /["'\s]/.test(k),
    looksLikeGoogleKey: /^AIza[\w-]{20,}$/.test(k),
  }
}

export function GET(): Response {
  return Response.json(
    {
      ok: true,
      ai: !!apiKey(),
      model: process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
      env: process.env.VERCEL_ENV ?? 'local',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      envNames: Object.keys(process.env).filter((k) => /gemini|gemma|google/i.test(k)),
      // Shape of the (public, site-restricted) Street View browser key, to debug a paste error. Never the value.
      streetViewKey: keyShape((process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.VITE_GOOGLE_MAPS_KEY || '').trim()),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
