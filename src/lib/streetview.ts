// Google Street View Static API: a street-level photo of the building's block. The key is a browser key
// restricted to this site's address and to the Street View Static API only, so it is public by design (unlike
// the Gemini key, which never leaves the server). Without a key the cards show the aerial view, as before.
export const STREET_VIEW_KEY: string = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined)?.trim() ?? ''

export const hasStreetView = () => STREET_VIEW_KEY.length > 0

/**
 * Image URL for a spot. `return_error_code=true` makes Google answer 404 when there is no photo within the
 * radius, so the <img> error handler can fall back to the aerial view instead of showing a grey "no imagery" tile.
 */
export function streetViewUrl(lat: number, lon: number, width = 640, height = 360): string {
  const q = new URLSearchParams({
    size: `${width}x${height}`,
    location: `${lat.toFixed(6)},${lon.toFixed(6)}`,
    radius: '80',
    source: 'outdoor',
    fov: '80',
    pitch: '5',
    return_error_code: 'true',
    key: STREET_VIEW_KEY,
  })
  return `https://maps.googleapis.com/maps/api/streetview?${q}`
}
