import { getSettings, markByokRejected } from "./settings";

// Must match the header name the backend reads in /backend/src/index.ts
// and lists in its CORS allowHeaders.
export const API_KEY_HEADER = "X-WhyShield-API-Key";

// Body the backend sends with a 401 when the user's own key was refused
// by Anthropic. Must match /backend/src/index.ts.
const BYOK_REJECTED_ERROR = "byok-rejected";

// The one place that knows how to reach the backend. Resolves the user's
// configured backend URL and attaches their own Anthropic key when set,
// so no caller can forget the header or read a stale URL. The key is
// added to the request and nowhere else: not logged, not cached.
export async function postToBackend(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const settings = await getSettings();
  const usingOwnKey = settings.apiKey !== "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (usingOwnKey) headers[API_KEY_HEADER] = settings.apiKey;

  const res = await fetch(`${settings.backendUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  // A rejected user key must not fail silently: callers fail open on any
  // non-OK response, which would quietly switch off every Claude-backed
  // check. Record the rejection so the options page can tell the user.
  // clone() so the caller still gets an unread body.
  if (usingOwnKey && res.status === 401) {
    const parsed = (await res
      .clone()
      .json()
      .catch(() => null)) as { error?: unknown } | null;
    if (parsed?.error === BYOK_REJECTED_ERROR) await markByokRejected();
  }
  return res;
}
