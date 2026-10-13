import { postToBackend } from "../shared/backend";
import { ANALYZE_EMAIL_PATH, ANALYZE_URL_PATH } from "../shared/config";
import type { AnalyzeEmailRequest, AnalyzeResponse } from "../shared/types";

// POST the URL to the backend for analysis. Returns null on transport
// failure so the caller can fail-open (let navigation proceed) rather than
// blocking the user when the backend is down. Backend URL and the optional
// BYOK header come from settings via postToBackend.
export async function analyzeUrl(url: string): Promise<AnalyzeResponse | null> {
  try {
    const res = await postToBackend(ANALYZE_URL_PATH, { url });
    if (!res.ok) return null;
    return (await res.json()) as AnalyzeResponse;
  } catch {
    return null;
  }
}

// Email parallel of analyzeUrl. Same fail-open contract: null on
// transport failure means "no banner," matching the URL flow's "no
// interstitial" behavior when the backend is down.
export async function analyzeEmail(payload: AnalyzeEmailRequest): Promise<AnalyzeResponse | null> {
  try {
    const res = await postToBackend(ANALYZE_EMAIL_PATH, payload);
    if (!res.ok) return null;
    return (await res.json()) as AnalyzeResponse;
  } catch {
    return null;
  }
}
