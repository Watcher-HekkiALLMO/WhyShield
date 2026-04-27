import { BACKEND_URL } from "../shared/config";
import type { AnalyzeResponse } from "../shared/types";

// POST the URL to our local Worker for analysis. Returns null on transport
// failure so the caller can fail-open (let navigation proceed) rather than
// blocking the user when the backend is down.
export async function analyzeUrl(url: string): Promise<AnalyzeResponse | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/analyze/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    return (await res.json()) as AnalyzeResponse;
  } catch {
    return null;
  }
}
