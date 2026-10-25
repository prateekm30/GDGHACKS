import type { Area } from './types'

/**
 * Every county and city in HUD's Washington-Arlington-Alexandria metro area, grouped the way people talk about them.
 * One table of income limits covers all of them. Colors are for the map only, never for text.
 */
export const AREAS: { id: Area; name: string; short: string; state: 'DC' | 'MD' | 'VA'; color: string; includes?: string }[] = [
  { id: 'DC', name: 'Washington, DC', short: 'DC', state: 'DC', color: '#d6264a' },
  { id: 'MONTGOMERY', name: 'Montgomery County', short: 'Montgomery', state: 'MD', color: '#ff6b4a' },
  { id: 'PRINCE_GEORGES', name: "Prince George's County", short: "Prince George's", state: 'MD', color: '#ff9f43' },
  { id: 'FREDERICK', name: 'Frederick County', short: 'Frederick', state: 'MD', color: '#ffc53d' },
  { id: 'SOUTHERN_MD', name: 'Charles and Calvert', short: 'Charles & Calvert', state: 'MD', color: '#ffd98a' },
  { id: 'ARLINGTON', name: 'Arlington', short: 'Arlington', state: 'VA', color: '#c2185b' },
  { id: 'ALEXANDRIA', name: 'Alexandria', short: 'Alexandria', state: 'VA', color: '#ff5fa2' },
  { id: 'FAIRFAX', name: 'Fairfax', short: 'Fairfax', state: 'VA', color: '#ff8fb1', includes: 'Fairfax County, Fairfax City, Falls Church' },
  { id: 'LOUDOUN', name: 'Loudoun County', short: 'Loudoun', state: 'VA', color: '#ffb8c8' },
  { id: 'PRINCE_WILLIAM', name: 'Prince William', short: 'Prince William', state: 'VA', color: '#9d6bff', includes: 'Prince William County, Manassas, Manassas Park' },
  { id: 'FREDERICKSBURG', name: 'Stafford and Fredericksburg', short: 'Stafford & Fredericksburg', state: 'VA', color: '#b88cff', includes: 'Stafford, Spotsylvania, Fredericksburg' },
  { id: 'FAUQUIER_CLARKE', name: 'Fauquier and Clarke', short: 'Fauquier & Clarke', state: 'VA', color: '#d9b8ff' },
]

const BY_ID = new Map(AREAS.map((a) => [a.id, a]))
export const areaInfo = (id: Area) => BY_ID.get(id) ?? { id, name: id, short: id, state: 'VA' as const, color: '#999' }
export const areaLabel = (id: Area) => {
  const a = areaInfo(id)
  return a.state === 'DC' ? 'Washington, DC' : `${a.name}, ${a.state}`
}

/** Big job and school hubs, for "close to work or school". Coordinates are the nearest Metro or campus. */
export const HUBS: { id: string; name: string; lat: number; lon: number }[] = [
  { id: 'downtown', name: 'Downtown DC (Metro Center)', lat: 38.8983, lon: -77.0281 },
  { id: 'capitol', name: 'Capitol Hill / NoMa', lat: 38.9066, lon: -77.003 },
  { id: 'navy', name: 'Navy Yard', lat: 38.8765, lon: -77.005 },
  { id: 'howard', name: 'Howard University / Shaw', lat: 38.9227, lon: -77.0194 },
  { id: 'gwu', name: 'Foggy Bottom / GWU', lat: 38.9006, lon: -77.0502 },
  { id: 'rosslyn', name: 'Rosslyn / Ballston', lat: 38.8964, lon: -77.0717 },
  { id: 'pentagon', name: 'Pentagon / Crystal City', lat: 38.8579, lon: -77.0511 },
  { id: 'oldtown', name: 'Old Town Alexandria', lat: 38.8048, lon: -77.0608 },
  { id: 'bethesda', name: 'Bethesda / NIH', lat: 38.9847, lon: -77.0947 },
  { id: 'silver', name: 'Silver Spring', lat: 38.9939, lon: -77.031 },
  { id: 'rockville', name: 'Rockville', lat: 39.084, lon: -77.1528 },
  { id: 'umd', name: 'College Park / UMD', lat: 38.9897, lon: -76.9378 },
  { id: 'largo', name: 'Largo / New Carrollton', lat: 38.9007, lon: -76.8448 },
  { id: 'tysons', name: 'Tysons', lat: 38.9187, lon: -77.2311 },
  { id: 'reston', name: 'Reston', lat: 38.9586, lon: -77.357 },
  { id: 'gmu', name: 'Fairfax / George Mason', lat: 38.8316, lon: -77.3089 },
  { id: 'dulles', name: 'Dulles / Ashburn', lat: 38.9531, lon: -77.4565 },
  { id: 'woodbridge', name: 'Woodbridge', lat: 38.6582, lon: -77.2497 },
]

export function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 3958.8
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = p2 - p1
  const dl = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(a))
}
