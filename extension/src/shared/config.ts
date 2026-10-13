// Default backend, chosen by Vite mode at build time: `pnpm dev` is
// development and uses localhost; `pnpm build` is production and bakes
// in the live worker. No manual switching. Users can still override it
// on the settings page; runtime code reads the effective value via
// getSettings() in shared/settings.ts, never this constant directly.
//
// The branch is "development → localhost, anything else → production"
// on purpose. The unsafe direction (a shippable bundle that sends email
// contents to whatever listens on the user's port 8787) should require
// opting in, not fall out of an unrecognized --mode.
export const PRODUCTION_BACKEND_URL = "https://whyshield-backend.knower.workers.dev";
export const BACKEND_URL =
  import.meta.env.MODE === "development" ? "http://localhost:8787" : PRODUCTION_BACKEND_URL;

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

// Per-install rate limiting. The header name must match
// /backend/src/rate-limit.ts. installId is minted once in
// shared/install-id.ts. The cooldown key is suffixed per path family
// (":analyze" / ":explain") by shared/backend.ts when the backend answers
// 429, and holds the ms-epoch of the next UTC hour.
export const INSTALL_HEADER = "X-WhyShield-Install";
export const INSTALL_ID_KEY = "installId";
export const RATE_LIMITED_UNTIL_KEY = "rateLimitedUntil";

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
