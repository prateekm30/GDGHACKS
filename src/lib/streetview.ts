// Google Street View Static API: a street-level photo of the building's block. The key is a browser key
// restricted to this site's address and to the Street View Static API only, so it is public by design (unlike
// the Gemini key, which never leaves the server). It comes baked into the build (VITE_GOOGLE_MAPS_KEY) or from
// /api/config at runtime, so adding it in Vercel needs no rebuild. Without a key the cards show the aerial view.
import { useSyncExternalStore } from 'react'

const KEY_SHAPE = /^AIza[\w-]{20,}$/
let key = ((import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ?? '').trim()
if (!KEY_SHAPE.test(key)) key = ''
let asked = false
const listeners = new Set<() => void>()

/** Fetch the runtime key once. Safe to call many times. */
export function loadStreetViewKey(): void {
  if (asked || key || typeof fetch === 'undefined') return
  asked = true
  fetch('/api/config')
    .then((r) => (r.ok ? (r.json() as Promise<{ streetViewKey?: string | null }>) : null))
    .then((c) => {
      const k = c?.streetViewKey?.trim() ?? ''
      if (KEY_SHAPE.test(k)) {
        key = k
        listeners.forEach((l) => l())
      }
    })
    .catch(() => {})
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** The current key ('' when none). Components re-render when the runtime key arrives. */
export function useStreetViewKey(): string {
  return useSyncExternalStore(subscribe, () => key, () => key)
}

/**
 * Image URL for a spot. `return_error_code=true` makes Google answer 404 when there is no photo within the
 * radius, so the <img> error handler can fall back to the aerial view instead of showing a grey "no imagery" tile.
 */
export function streetViewUrl(lat: number, lon: number, k = key, width = 640, height = 360): string {
  const q = new URLSearchParams({
    size: `${width}x${height}`,
    location: `${lat.toFixed(6)},${lon.toFixed(6)}`,
    radius: '80',
    source: 'outdoor',
    fov: '80',
    pitch: '5',
    return_error_code: 'true',
    key: k,
  })
  return `https://maps.googleapis.com/maps/api/streetview?${q}`
}
