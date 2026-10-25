// GET /api/config -> public, browser-side settings. Only the Street View browser key lives here: it is meant to
// be public (restricted in Google Cloud to this site's address and to the Street View Static API). Serving it
// at runtime means adding the key in Vercel works without a rebuild. The Gemini key is never exposed.
export function GET(): Response {
  const raw = (process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.VITE_GOOGLE_MAPS_KEY || '').trim()
  const streetViewKey = /^AIza[\w-]{20,}$/.test(raw) ? raw : null
  return Response.json({ streetViewKey }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } })
}
