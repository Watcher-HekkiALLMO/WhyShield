import { INSTALL_HEADER, RATE_LIMITED_UNTIL_KEY } from "./config";
import { getInstallId } from "./install-id";
import { getSettings, markByokRejected } from "./settings";

// Must match the header name the backend reads in /backend/src/index.ts
// and lists in its CORS allowHeaders.
export const API_KEY_HEADER = "X-WhyShield-API-Key";

// Bodies the backend sends with specific statuses. Must match
// /backend/src/index.ts and /backend/src/rate-limit.ts.
const BYOK_REJECTED_ERROR = "byok-rejected";
const RATE_LIMITED_ERROR = "rate-limited";

const HOUR_MS = 60 * 60 * 1000;

// The backend keeps separate hourly budgets for /analyze/* and
// /explain/*, so the client cooldown is tracked per family too. A 429
// from an explain stream must not switch off URL and email analysis.
type Scope = "analyze" | "explain";

function scopeFor(path: string): Scope {
  return path.startsWith("/explain") ? "explain" : "analyze";
}

function cooldownKey(scope: Scope): string {
  return `${RATE_LIMITED_UNTIL_KEY}:${scope}`;
}

// Once told "rate-limited" there's no point asking again until the next
// UTC hour starts. Stored in chrome.storage.local so the background
// worker, side panel, and options page all honor the same cooldown.
// A stored value more than an hour out is ignored: it can only come from
// a clock that was wrong when it was written, and must not pin the
// extension in fail-open indefinitely.
async function isCoolingDown(scope: Scope): Promise<boolean> {
  const key = cooldownKey(scope);
  const stored = await chrome.storage.local.get(key);
  const until = stored[key];
  if (typeof until !== "number") return false;
  const now = Date.now();
  return until > now && until - now <= HOUR_MS;
}

function nextHourBoundary(now: number): number {
  return (Math.floor(now / HOUR_MS) + 1) * HOUR_MS;
}

// Stand-in for a request we chose not to send. Same status + body the
// backend would have returned, so callers keep their one fail-open path.
function syntheticRateLimited(): Response {
  return new Response(JSON.stringify({ error: RATE_LIMITED_ERROR }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
}

// The one place that knows how to reach the backend. Resolves the user's
// configured backend URL, attaches the per-install id, and attaches their
// own Anthropic key when set, so no caller can forget a header or read a
// stale URL. Neither the key nor the install id is logged anywhere.
export async function postToBackend(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const scope = scopeFor(path);
  const [settings, installId, coolingDown] = await Promise.all([
    getSettings(),
    getInstallId(),
    isCoolingDown(scope),
  ]);

  if (coolingDown) return syntheticRateLimited();

  const usingOwnKey = settings.apiKey !== "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [INSTALL_HEADER]: installId,
  };
  if (usingOwnKey) headers[API_KEY_HEADER] = settings.apiKey;

  const res = await fetch(`${settings.backendUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  // Two statuses carry a signal we act on. Everything else is the
  // caller's business. clone() so the caller still gets an unread body.
  if (res.status === 429 || (usingOwnKey && res.status === 401)) {
    const parsed = (await res
      .clone()
      .json()
      .catch(() => null)) as { error?: unknown } | null;

    if (res.status === 429 && parsed?.error === RATE_LIMITED_ERROR) {
      await chrome.storage.local.set({ [cooldownKey(scope)]: nextHourBoundary(Date.now()) });
    }
    // A rejected user key must not fail silently: callers fail open on any
    // non-OK response, which would quietly switch off every Claude-backed
    // check. Record the rejection so the options page can tell the user.
    if (res.status === 401 && parsed?.error === BYOK_REJECTED_ERROR) {
      await markByokRejected();
    }
  }
  return res;
}
