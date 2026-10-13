// User settings. Single source of truth for every tunable the extension
// reads at runtime. Consumers call getSettings(); nobody reads
// chrome.storage for these keys directly, so defaults + validation live
// in exactly one place.
//
// Two storage areas on purpose:
//   - chrome.storage.sync  → settings the user wants everywhere they're
//                            signed in to Chrome.
//   - chrome.storage.local → the API key only. A secret must not ride
//                            Chrome Sync onto other devices or Google's
//                            servers.

import { BACKEND_URL, SUSPICIOUS_INTERSTITIAL_THRESHOLD } from "./config";

export interface Settings {
  backendUrl: string;
  // "Suspicious" verdicts at or above this confidence trigger a warning.
  // Lower = more warnings.
  sensitivity: number;
  // Exact host matches that are never analyzed. Lowercase, no scheme,
  // port kept if present. Subdomains do NOT inherit (same rule as the
  // Continue-anyway bypass list).
  trustedHosts: string[];
  urlWarnings: boolean;
  emailWarnings: boolean;
  // Bring-your-own Anthropic key. "" means not set. Sent per-request as
  // a header; never synced, never logged.
  apiKey: string;
}

export const SENSITIVITY_MIN = 0.5;
export const SENSITIVITY_MAX = 0.9;
export const SENSITIVITY_STEP = 0.05;

// config.ts constants remain the defaults; settings.ts only layers
// user overrides on top.
export const DEFAULT_SETTINGS: Settings = {
  backendUrl: BACKEND_URL,
  sensitivity: SUSPICIOUS_INTERSTITIAL_THRESHOLD,
  trustedHosts: [],
  urlWarnings: true,
  emailWarnings: true,
  apiKey: "",
};

type SyncSettings = Omit<Settings, "apiKey">;
const SYNC_KEYS: (keyof SyncSettings)[] = [
  "backendUrl",
  "sensitivity",
  "trustedHosts",
  "urlWarnings",
  "emailWarnings",
];
const LOCAL_API_KEY = "apiKey";

// Returns the URL with any trailing slash removed, or null if it isn't a
// well-formed http(s) URL. Trailing slash is stripped because every
// consumer appends a path that starts with "/".
export function normalizeBackendUrl(raw: string): string | null {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.host === "") return null;
  return trimmed.replace(/\/+$/, "");
}

// Accepts "paypal.com", "PayPal.com", or a pasted "https://paypal.com/x"
// and returns the lowercase host, or null if the line can't be read as
// one. Prefixing "http://" lets the URL parser do the host validation
// for bare hostnames.
export function normalizeHost(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "") return null;
  const withScheme = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
  try {
    const host = new URL(withScheme).host;
    return host === "" ? null : host;
  } catch {
    return null;
  }
}

export function isTrustedHost(host: string, settings: Settings): boolean {
  return settings.trustedHosts.includes(host.toLowerCase());
}

function clampSensitivity(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.sensitivity;
  return Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, n));
}

// Every stored field is type-checked and falls back to its default. An
// older build (or a hand-edited sync blob) can leave a wrong shape in
// storage, and a bad setting should never crash the background worker.
export async function getSettings(): Promise<Settings> {
  const [sync, local] = await Promise.all([
    chrome.storage.sync.get(SYNC_KEYS),
    chrome.storage.local.get(LOCAL_API_KEY),
  ]);

  const backendUrl =
    typeof sync.backendUrl === "string" ? normalizeBackendUrl(sync.backendUrl) : null;
  const trustedHosts = Array.isArray(sync.trustedHosts)
    ? sync.trustedHosts.filter((h): h is string => typeof h === "string")
    : DEFAULT_SETTINGS.trustedHosts;

  return {
    backendUrl: backendUrl ?? DEFAULT_SETTINGS.backendUrl,
    sensitivity:
      typeof sync.sensitivity === "number"
        ? clampSensitivity(sync.sensitivity)
        : DEFAULT_SETTINGS.sensitivity,
    trustedHosts,
    urlWarnings:
      typeof sync.urlWarnings === "boolean" ? sync.urlWarnings : DEFAULT_SETTINGS.urlWarnings,
    emailWarnings:
      typeof sync.emailWarnings === "boolean" ? sync.emailWarnings : DEFAULT_SETTINGS.emailWarnings,
    apiKey: typeof local.apiKey === "string" ? local.apiKey : DEFAULT_SETTINGS.apiKey,
  };
}

// Caller is responsible for passing already-normalized values (the
// options page validates before calling). An empty API key removes the
// local entry rather than storing "".
export async function saveSettings(settings: Settings): Promise<void> {
  const { apiKey, ...sync } = settings;
  await Promise.all([
    chrome.storage.sync.set(sync),
    apiKey === ""
      ? chrome.storage.local.remove(LOCAL_API_KEY)
      : chrome.storage.local.set({ [LOCAL_API_KEY]: apiKey }),
  ]);
}
