/**
 * Read a yearly income the way people type it: "52,000", "$52,000.00", "52000.75", "52k", "1.5K".
 * Cents are dropped. Anything that is not a number is null.
 */
export function parseIncome(raw: string): number | null {
  const s = raw.replace(/[\s$,]/g, '').toLowerCase()
  const m = s.match(/^(\d+(?:\.\d+)?)(k)?/)
  if (!m) return null
  let n = Number(m[1])
  if (m[2]) n *= 1000
  n = Math.floor(n)
  return n > 0 && Number.isFinite(n) ? n : null
}
