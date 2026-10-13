// Default backend. Users can override it on the settings page; runtime
// code reads the effective value via getSettings() in shared/settings.ts,
// never this constant directly.
export const BACKEND_URL = "http://localhost:8787";

// Backend endpoint for URL analysis.
export const ANALYZE_URL_PATH = "/analyze/url";

export const VERDICT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const BYPASS_TTL_MS = 60 * 60 * 1000; // 1 hour

// Default threshold at or above which a "suspicious" verdict triggers a
// warning (URL interstitial or email banner). The user tunes this on the
// settings page as "sensitivity"; consumers read it via getSettings().
export const SUSPICIOUS_INTERSTITIAL_THRESHOLD = 0.7;

// Path inside the extension to the warning interstitial HTML.
export const WARNING_PAGE_PATH = "src/warning/index.html";

// Backend SSE endpoint for streaming Claude explanations.
export const EXPLAIN_URL_PATH = "/explain/url";

// Backend endpoints for email analysis + streaming explanation.
export const ANALYZE_EMAIL_PATH = "/analyze/email";
export const EXPLAIN_EMAIL_PATH = "/explain/email";

// chrome.storage.local key prefixes for email state. Both are documented
// next to their consumers in background/storage.ts.
export const EMAIL_VERDICT_KEY_PREFIX = "email-verdict:";
export const EMAIL_SAFE_KEY_PREFIX = "email-safe:";

// chrome.storage.session key prefix for per-tab explain context. Full
// key: `${EXPLAIN_CONTEXT_KEY_PREFIX}${tabId}`. The side panel reads and
// immediately deletes its tab's entry on mount, so reopening the panel
// from the toolbar without re-clicking "Explain why" lands on the
// no-data state by design.
export const EXPLAIN_CONTEXT_KEY_PREFIX = "explain:tab-";
