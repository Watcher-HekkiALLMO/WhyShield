# WhyShield

An open-source Chrome extension that detects phishing emails and spoofed websites in real time — and **explains in plain English why** something is suspicious.

Most safety tools block silently. WhyShield teaches.

## Status

Early development. This repo currently contains:

- `/backend` — Cloudflare Worker with `POST /analyze/url` (heuristics + Claude Haiku fallback, KV verdict cache)
- `/extension` — Chrome extension (Manifest V3) with URL warning interstitial; side-panel streaming and Gmail email warnings still to come

## Repo layout

```
extension/   Chrome extension (Manifest V3, TypeScript)
backend/     Cloudflare Worker (TypeScript + Hono)
```

## Running the backend locally

Requires Node.js 20+ and pnpm.

```bash
pnpm install
cd backend
cp .dev.vars.example .dev.vars   # then edit and add your ANTHROPIC_API_KEY
pnpm dev                          # starts wrangler dev on http://localhost:8787
```

You should see `[wrangler:inf] Ready on http://127.0.0.1:8787`. Two startup warnings are expected and safe to ignore: a "wrangler is out-of-date" notice (we're pinned to v3 for now), and a compatibility-date fallback notice (our manifest declares a date newer than wrangler 3's bundled runtime supports — production Cloudflare will support it).

The KV namespace id in `backend/wrangler.toml` is a fake placeholder (`0000000000000000000000000000abcd`). In local dev, Miniflare ignores it and provides an in-memory simulator. Replace it with a real id only when deploying to Cloudflare.

Test the URL analyzer:

```bash
curl -X POST http://localhost:8787/analyze/url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://paypa1.com/login"}'
```

Expected response shape:

```json
{
  "verdict": "malicious",
  "confidence": 0.95,
  "reasons": [{ "code": "typosquat-of-brand", "detail": "paypal.com" }],
  "explanation": "This site looks one character off from paypal.com, which is a common phishing trick."
}
```

## License

MIT — see [LICENSE](LICENSE).
