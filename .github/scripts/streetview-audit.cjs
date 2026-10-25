// Samples buildings from the live site and checks Street View for each: metadata by address (free call), the
// distance between Google's photo spot and HUD's coordinates, and the image itself, saved for a human to look at.
// Needs network and the public browser key from /api/config. Usage: node streetview-audit.cjs <site-url> <out-dir>
const fs = require('node:fs')
const [url, out] = process.argv.slice(2)
const KEY_SHAPE = /^AIza[\w-]{20,}$/
const usable = (a) => !!a && /^\d+[a-z]?\s+\S/i.test(a.trim()) && !/\b(lot|scattered|various|multiple|p\.?o\.? box)\b/i.test(a)
const loc = (b) => (usable(b.address) ? `${b.address.replace(/\s+(apt|unit|ste|suite|#)\s*\S+$/i, '')}, ${b.city}, ${b.state} ${b.zip}` : `${b.lat},${b.lon}`)
const miles = (a, b, c, d) => {
  const r = 3958.8, p1 = (a * Math.PI) / 180, p2 = (c * Math.PI) / 180, dp = p2 - p1, dl = ((d - b) * Math.PI) / 180
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(x))
}
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const key = (await (await fetch(`${url}/api/config`)).json()).streetViewKey
  if (!KEY_SHAPE.test(key || '')) { console.log('no key'); return }
  const all = await (await fetch(`${url}/data/buildings.json`)).json()
  const pool = all.filter((b) => !b.groupHome && !b.seniorOnly && !b.disabilityOnly)
  const sample = pool.filter((_, i) => i % Math.floor(pool.length / 14) === 0).slice(0, 14)
  const report = []
  for (const b of sample) {
    const q = new URLSearchParams({ location: loc(b), radius: '50', source: 'outdoor', key })
    const meta = await (await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${q}`, { headers: { Referer: `${url}/` } })).json()
    const row = { id: b.id, name: b.name, address: `${b.address}, ${b.city}`, asked: loc(b), status: meta.status, date: meta.date }
    if (meta.status === 'OK') {
      row.panoToHudFeet = Math.round(miles(meta.location.lat, meta.location.lng, b.lat, b.lon) * 5280)
      const img = await fetch(`https://maps.googleapis.com/maps/api/streetview?${new URLSearchParams({ size: '640x360', location: loc(b), radius: '50', source: 'outdoor', fov: '80', pitch: '5', return_error_code: 'true', key })}`, { headers: { Referer: `${url}/` } })
      row.image = img.status
      if (img.ok) fs.writeFileSync(`${out}/${b.id}.jpg`, Buffer.from(await img.arrayBuffer()))
    }
    report.push(row)
    console.log(JSON.stringify(row))
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1))
  const ok = report.filter((r) => r.status === 'OK').length
  console.log(`${ok} of ${report.length} sampled buildings have a Street View photo by address`)
})()
