# WhyShield

An open-source Chrome extension that detects phishing emails and spoofed websites in real time — and **explains in plain English why** something is suspicious.

Most safety tools block silently. WhyShield teaches.

## Status

Early development. This repo currently contains:

- `/backend` — Cloudflare Worker that analyzes URLs (in progress)
- `/extension` — Chrome extension (not yet started)

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
