// Plain case-insensitive substring scan over a curated phrase list.
// Returns every phrase that hit so callers can show a useful detail line.
//
// Used for both urgency and credential-request scans (different lists,
// same scanner). Kept dumb on purpose — phrase tuning happens in
// email-keywords.ts, not here.

export interface KeywordHit {
  matched: string[];
}

export function scanKeywords(text: string, keywords: readonly string[]): KeywordHit | null {
  if (text.length === 0) return null;
  const haystack = text.toLowerCase();
  const matched: string[] = [];
  for (const kw of keywords) {
    if (kw.length === 0) continue;
    if (haystack.includes(kw.toLowerCase())) matched.push(kw);
  }
  return matched.length === 0 ? null : { matched };
}
