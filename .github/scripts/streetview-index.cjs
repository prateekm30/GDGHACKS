// Decides, for every building, where Street View should look: the street address ('a'), HUD's coordinates
// ('c'), or nowhere ('n'). Uses the free metadata endpoint only. Writes public/data/streetview.json and, for
// the first conflicts (address and coordinates land on different photo spots), saves both images for review.
// Usage: node streetview-index.cjs <site-url> <out-json> [conflict-dir]
const fs = require('node:fs')
const [url, outJson, conflictDir] = process.argv.slice(2)
const KEY_SHAPE = /^AIza[\w-]{20,}$/
const CONFLICT_FEET = 330 // ~100 m
const usable = (a) => !!a && /^\d+[a-z]?\s+\S/i.test(a.trim()) && !/\b(lot|scattered|various|multiple|p\.?o\.? box)\b/i.test(a)
const addr = (b) => `${b.address.replace(/\s+(apt|unit|ste|suite|#)\s*\S+$/i, '')}, ${b.city}, ${b.state} ${b.zip}`
const coords = (b) => `${b.lat.toFixed(6)},${b.lon.toFixed(6)}`
const feet = (a, b, c, d) => {
  const r = 20902231, p1 = (a * Math.PI) / 180, p2 = (c * Math.PI) / 180, dp = p2 - p1, dl = ((d - b) * Math.PI) / 180
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return Math.round(2 * r * Math.asin(Math.sqrt(x)))
}
// In a conflict, which side wins. Set from looking at the saved pairs: see README "Street View".
const PREFER_IN_CONFLICT = process.env.SV_PREFER || 'c'

async function meta(key, location, radius) {
  const q = new URLSearchParams({ location, radius: String(radius), source: 'outdoor', key })
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${q}`, { headers: { Referer: `${url}/` } })
      if (r.ok) return r.json()
    } catch {}
    await new Promise((ok) => setTimeout(ok, 400 * (t + 1)))
  }
  return { status: 'ERROR' }
}
async function image(key, location, file) {
  const q = new URLSearchParams({ size: '640x360', location, radius: '60', source: 'outdoor', fov: '80', pitch: '5', return_error_code: 'true', key })
  const r = await fetch(`https://maps.googleapis.com/maps/api/streetview?${q}`, { headers: { Referer: `${url}/` } })
  if (r.ok) fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()))
}

;(async () => {
  const key = (await (await fetch(`${url}/api/config`)).json()).streetViewKey
  if (!KEY_SHAPE.test(key || '')) throw new Error('no Street View key on the site')
  const all = await (await fetch(`${url}/data/buildings.json`)).json()
  const byId = {}
  const counts = { a: 0, c: 0, n: 0, conflicts: 0, onlyAddress: 0, onlyCoords: 0, agree: 0 }
  const conflicts = []
  let i = 0
  const worker = async () => {
    while (i < all.length) {
      const b = all[i++]
      const [A, C] = await Promise.all([usable(b.address) ? meta(key, addr(b), 50) : { status: 'SKIP' }, meta(key, coords(b), 80)])
      const aOk = A.status === 'OK', cOk = C.status === 'OK'
      let pick = 'n'
      if (aOk && cOk) {
        const d = feet(A.location.lat, A.location.lng, C.location.lat, C.location.lng)
        if (d < CONFLICT_FEET) { pick = 'a'; counts.agree++ } else { pick = PREFER_IN_CONFLICT; counts.conflicts++; conflicts.push({ id: b.id, name: b.name, address: addr(b), feetApart: d, addressPanoToHud: feet(A.location.lat, A.location.lng, b.lat, b.lon) }) }
      } else if (aOk) { pick = 'a'; counts.onlyAddress++ } else if (cOk) { pick = 'c'; counts.onlyCoords++ }
      counts[pick]++
      byId[b.id] = pick
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  fs.writeFileSync(outJson, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), rule: `address unless address and coordinates disagree by ${CONFLICT_FEET} ft, then ${PREFER_IN_CONFLICT}`, counts, byId }))
  console.log(JSON.stringify(counts))
  if (conflictDir) {
    fs.mkdirSync(conflictDir, { recursive: true })
    const sample = conflicts.filter((_, k) => k % Math.max(1, Math.floor(conflicts.length / 16)) === 0).slice(0, 16)
    for (const c of sample) {
      const b = all.find((x) => x.id === c.id)
      await image(key, addr(b), `${conflictDir}/${c.id}-a.jpg`)
      await image(key, coords(b), `${conflictDir}/${c.id}-c.jpg`)
    }
    fs.writeFileSync(`${conflictDir}/conflicts.json`, JSON.stringify(conflicts, null, 1))
    console.log(`${conflicts.length} conflicts, ${sample.length} saved as image pairs`)
  }
})()
