// Phrases the app must never show, because only the property decides eligibility
// and we have no waitlist data. Used by the API (on model output) and by tests.
export const BANNED_PATTERNS: RegExp[] = [
  /\byou (?:do |will |would )?qualify\b/i,
  /\byou(?:'re| are) (?:eligible|approved)\b/i,
  // Claims that the person is approved. "HUD-approved ID" or "an approved form of payment" is ordinary form
  // wording and must not knock out a real checklist item.
  /\byou(?:'ve| have)? been (?:pre-?)?approved\b/i,
  /\b(?:your |the )?application (?:is |has been |was |got )?(?:pre-?)?approved\b/i,
  /\b(?:pre-?)?approved for (?:this|the|a|an|your) (?:unit|apartment|home|lease|building)\b/i,
  /\bpre-?approved\b/i,
  /\bguarantee[ds]?\b/i,
  // "Ask if the waitlist is open" is fine; stating that it is open is not (we have no waitlist data).
  /(?<!\b(?:if|whether) (?:the |your |their )?)\bwait(?:\s?list|ing list) is open\b/i,
]

export function findBannedPhrase(text: string): string | null {
  for (const re of BANNED_PATTERNS) {
    const m = text.match(re)
    if (m) return m[0]
  }
  return null
}
