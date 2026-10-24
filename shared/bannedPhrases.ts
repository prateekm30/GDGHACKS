// Phrases the app must never show, because only the property decides eligibility
// and we have no waitlist data. Used by the API (on model output) and by tests.
export const BANNED_PATTERNS: RegExp[] = [
  /\byou (?:do |will |would )?qualify\b/i,
  /\byou(?:'re| are) (?:eligible|approved)\b/i,
  /\bapproved\b/i,
  /\bguarantee[ds]?\b/i,
  /\bwait\s?list is open\b/i,
  /\bwaiting list is open\b/i,
]

export function findBannedPhrase(text: string): string | null {
  for (const re of BANNED_PATTERNS) {
    const m = text.match(re)
    if (m) return m[0]
  }
  return null
}
