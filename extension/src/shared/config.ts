// Local dev backend. When we deploy to Cloudflare, we'll add a
// chrome.storage override so users (and CI) can flip between dev and prod.
export const BACKEND_URL = "http://localhost:8787";

export const VERDICT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const BYPASS_TTL_MS = 60 * 60 * 1000; // 1 hour

// Threshold above which a "suspicious" verdict triggers the interstitial.
// Below this, navigation proceeds silently.
export const SUSPICIOUS_INTERSTITIAL_THRESHOLD = 0.7;

// Path inside the extension to the warning interstitial HTML.
export const WARNING_PAGE_PATH = "src/warning/index.html";

// Backend SSE endpoint for streaming Claude explanations.
export const EXPLAIN_URL_PATH = "/explain/url";

// chrome.storage.session key prefix for per-tab explain context. Full
// key: `${EXPLAIN_CONTEXT_KEY_PREFIX}${tabId}`. The side panel reads and
// immediately deletes its tab's entry on mount, so reopening the panel
// from the toolbar without re-clicking "Explain why" lands on the
// no-data state by design.
export const EXPLAIN_CONTEXT_KEY_PREFIX = "explain:tab-";
