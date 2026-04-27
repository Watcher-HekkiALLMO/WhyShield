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
