// Common homoglyphs phishers swap into Latin domain names. Used by
// foldHomoglyphs(), which is called from typosquat detection after we
// decode any punycode label back to Unicode. The list isn't exhaustive —
// it covers the most-abused Cyrillic and Greek lookalikes.
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic → Latin
  "а": "a",
  "е": "e",
  "о": "o",
  "р": "p",
  "с": "c",
  "у": "y",
  "х": "x",
  "ѕ": "s",
  "і": "i",
  "ј": "j",
  "ԁ": "d",
  "ӏ": "l",
  // Greek → Latin
  "α": "a",
  "ο": "o",
  "ρ": "p",
  "ν": "v",
  "ι": "i",
  "ε": "e",
};

export interface NormalizedUrl {
  raw: string;
  url: URL;
  host: string; // lowercased, port + trailing dot stripped
  isPunycode: boolean;
}

// Parse + normalize a URL. Returns null if it's malformed or uses a scheme
// we don't analyze (mailto:, javascript:, ftp:, etc.). The URL constructor
// auto-encodes Unicode hostnames to punycode, so we surface that as a flag
// for downstream heuristics to inspect rather than trying to undo it here.
export function normalizeUrl(raw: string): NormalizedUrl | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  let host = url.hostname.toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);

  const isPunycode = host.split(".").some((label) => label.startsWith("xn--"));

  return { raw, url, host, isPunycode };
}

// Fold visually-confusable characters into their Latin equivalents so a
// homoglyph spoof like "pаypal.com" (Cyrillic а) compares equal to the real
// "paypal.com". Apply this *after* punycode decoding.
export function foldHomoglyphs(input: string): string {
  let out = "";
  for (const ch of input) {
    out += HOMOGLYPH_MAP[ch] ?? ch;
  }
  return out;
}
