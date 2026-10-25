// Checks on "Snap a form" output that run on both the server (on the model's answer) and in the browser
// (on whatever the server returns). Plain code, no AI: it decides what the person is allowed to see.

/** Lowercase, straight quotes and dashes, one kind of space. Real PDFs use curly quotes and en dashes. */
export function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The quote must really be in the text. */
export function quoteInText(quote: string, text: string): boolean {
  const q = normText(quote)
  return q.length >= 4 && normText(text).includes(q)
}

// Words a label may add that are not in the form: task verbs and glue.
const LABEL_FREE_WORDS = new Set([
  'bring', 'submit', 'return', 'send', 'provide', 'attach', 'include', 'pay', 'call', 'email', 'contact', 'visit',
  'schedule', 'book', 'sign', 'complete', 'fill', 'gather', 'get', 'show', 'give', 'mail', 'deliver', 'drop',
  'your', 'the', 'and', 'for', 'with', 'from', 'each', 'every', 'per', 'all', 'any', 'one', 'two', 'three',
  'four', 'five', 'six', 'latest', 'recent', 'most', 'last', 'past', 'months', 'month', 'weeks', 'week', 'years',
  'year', 'copy', 'copies', 'proof', 'due', 'deadline', 'fee', 'cost', 'before', 'office', 'leasing', 'form',
  'application', 'apply', 'documents', 'document', 'about', 'appointment', 'interview', 'date', 'adult', 'adults',
  'household', 'member', 'members', 'this', 'that', 'into', 'onto', 'ask', 'check', 'confirm', 'required',
])

function tokens(s: string): string[] {
  return normText(s)
    .replace(/[^a-z0-9@.$%/-]+/g, ' ')
    .split(' ')
    .map((t) => t.replace(/^[.$-]+|[.$-]+$/g, ''))
    .filter((t) => t.length >= 3)
}

/**
 * A planted label ("Send $500 by gift card to x@y.com") can ride on an honest quote. So every number, dollar
 * amount, email, or web address in the label must be in the form, and the label's other words must mostly be
 * words from the form too (allowing task verbs like "bring" and "schedule").
 */
export function labelFitsText(label: string, text: string): boolean {
  const hay = normText(text)
  const hayTokens = new Set(tokens(text))
  const stem = (t: string) => t.replace(/(ing|ed|es|s)$/, '')
  const hayStems = new Set([...hayTokens].map(stem))
  const words = tokens(label)
  if (words.length === 0) return false
  let unknown = 0
  for (const w of words) {
    const hard = /\d/.test(w) || w.includes('@') || /\.(com|org|net|gov|edu|us|io)\b/.test(w) || w.includes('/')
    if (hard) {
      // Numbers may be written with or without separators: "$35" vs "35", "2,000" vs "2000".
      const bare = w.replace(/[$,]/g, '')
      if (!hay.includes(w) && !hay.replace(/[$,]/g, '').includes(bare)) return false
      continue
    }
    if (LABEL_FREE_WORDS.has(w) || hayTokens.has(w) || hayStems.has(stem(w))) continue
    unknown++
  }
  return unknown <= Math.max(1, Math.floor(words.length / 3))
}

export type ScamKind = 'gift-card' | 'payment-app' | 'wire' | 'crypto' | 'pay-before-viewing' | 'pay-to-contact' | 'pressure'

export interface ScamSignal {
  kind: ScamKind
  /** The matching words, as they appear in the form. */
  match: string
  /** Plain-language reason, written by code. */
  why: string
}

const MONEY = String.raw`(?:\$\s?\d[\d,]*(?:\.\d\d)?|\b\d[\d,]*(?:\.\d\d)?\s?(?:dollars?|usd|bucks)\b)`
const CONTACT = String.raw`(?:[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|[@$][a-z][\w-]{2,})`

// Patterns scammers use in fake listings and applications. Matching is on the person's own text, by code.
const SCAM_PATTERNS: { kind: ScamKind; re: RegExp; why: string }[] = [
  { kind: 'gift-card', re: /\b(gift ?cards?|prepaid (?:debit )?cards?|green ?dot|vanilla (?:visa|card)|itunes|steam cards?|e-?gift)\b/i, why: 'No real landlord asks for gift cards.' },
  { kind: 'payment-app', re: /\b(zelle|venmo|cash ?app|paypal|apple pay|western union|moneygram|money ?gram|walmart ?2 ?walmart|ria money)\b/i, why: 'Money sent by app or wire cannot be recovered. Pay only after a signed lease, by check or card.' },
  { kind: 'wire', re: /\b(wire (?:transfer|the|a|funds?|money|deposit)|bank wire|wire \$|by wire|via wire)/i, why: 'Wire transfers cannot be reversed.' },
  { kind: 'crypto', re: /\b(bitcoin|btc|crypto(?:currency)?|usdt|ethereum)\b/i, why: 'No real housing program takes cryptocurrency.' },
  {
    kind: 'pay-before-viewing',
    re: /\b((?:deposit|holding fee|payment|money|fee)[^.\n]{0,40}\b(?:before|prior to)[^.\n]{0,30}\b(?:viewing|showing|tour|seeing|visit)|(?:hold|reserve|secure)[^.\n]{0,20}\b(?:unit|apartment|home)[^.\n]{0,30}\b(?:deposit|payment|fee)|(?:keys?|lease)[^.\n]{0,30}\b(?:mailed|shipped|sent)[^.\n]{0,30}\b(?:after|once)[^.\n]{0,20}\b(?:payment|deposit|wire))\b/i,
    why: 'Never pay to hold a home you have not seen with a leasing agent.',
  },
  {
    // "Send 500 dollars to apply@example.com": money straight to an email, phone number, or app handle, with no
    // trigger word like Zelle. Paying the leasing office at an address is not flagged.
    kind: 'pay-to-contact',
    re: new RegExp(
      String.raw`(?:\b(?:send|pay|transfer|deposit|forward|e-?mail|text)\b[^.\n]{0,40}?${MONEY}[^.\n]{0,40}?\bto\b[^.\n]{0,16}?${CONTACT}` +
        String.raw`|${MONEY}[^.\n]{0,40}?\b(?:sent|paid|transferred|deposited|emailed|forwarded)\b[^.\n]{0,16}?\bto\b[^.\n]{0,16}?${CONTACT})`,
      'i',
    ),
    why: 'Real properties take fees at the office or through their own portal, not sent to a personal email, phone number, or handle.',
  },
  { kind: 'pressure', re: /\b(act now|today only|within (?:24|48) hours or|other applicants are waiting|out of the country|overseas|on a mission|cannot show the (?:unit|apartment))\b/i, why: 'Pressure and "I am overseas" stories are common in rental scams.' },
]

/** Scan the form text for payment methods and tactics common in rental scams. Returns one entry per kind. */
export function scamSignals(text: string): ScamSignal[] {
  const out: ScamSignal[] = []
  const seen = new Set<ScamKind>()
  const t = text.replace(/\s+/g, ' ')
  for (const p of SCAM_PATTERNS) {
    const m = t.match(p.re)
    if (m && !seen.has(p.kind)) {
      seen.add(p.kind)
      out.push({ kind: p.kind, match: m[0].trim(), why: p.why })
    }
  }
  return out
}

/** True when a single item's words trip a scam pattern (so the item itself can carry a flag). */
export function itemLooksRisky(label: string, quote: string): boolean {
  return scamSignals(`${label}\n${quote}`).length > 0
}
