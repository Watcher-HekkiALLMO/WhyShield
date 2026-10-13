import { getSettings } from "./settings";

// Must match the header name the backend reads in /backend/src/index.ts
// and lists in its CORS allowHeaders.
export const API_KEY_HEADER = "X-WhyShield-API-Key";

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
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.apiKey !== "") headers[API_KEY_HEADER] = settings.apiKey;
  return fetch(`${settings.backendUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
}
