# WhyShield

An open-source Chrome extension that detects phishing emails and spoofed websites in real time — and **explains in plain English why** something is suspicious.

Most safety tools block silently. WhyShield teaches.

## Status

Early development. This repo currently contains:

- `/backend` — Cloudflare Worker with `POST /analyze/url`, `POST /analyze/email`, and streaming `POST /explain/url`, `POST /explain/email` (heuristics + Claude Haiku fallback, KV verdict cache)
- `/extension` — Chrome extension (Manifest V3) with URL warning interstitial; Gmail content script and email warning banner still to come

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

Stream a Sonnet explanation:

```bash
curl -N -X POST http://localhost:8787/explain/url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://paypa1.com/login",
    "verdict": "malicious",
    "confidence": 0.95,
    "reasons": [{"code": "typosquat-of-brand", "detail": "paypal.com"}]
  }'
```

Returns Server-Sent Events. Each event has shape `data: "<JSON-encoded text chunk>"`. Stream ends with `data: [DONE]`. The `-N` (no-buffer) flag is required to see chunks as they arrive.

Test the email analyzer with a fake phishing payload:

```bash
curl -X POST http://localhost:8787/analyze/email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "PayPal Service <noreply@paypa1.com>",
    "replyTo": "billing@otherdomain.xyz",
    "subject": "Action required: verify your account",
    "body": "Final notice: your account will be locked unless you verify your password at the link below.",
    "links": ["https://paypa1.com/login"],
    "headerHints": { "spfPass": false, "dkimPass": false, "dmarcPass": false }
  }'
```

Expected response shape (a typosquat link in the body short-circuits to a conclusive verdict):

```json
{
  "verdict": "malicious",
  "confidence": 0.95,
  "reasons": [
    {
      "code": "link-typosquat-of-brand",
      "detail": "paypal.com (in link: https://paypa1.com/login)"
    }
  ],
  "explanation": "This email contains a link that looks one character off from a real brand's address — a common phishing trick. ..."
}
```

Other email reason codes you may see: `display-name-spoof`, `reply-to-mismatch`, `urgency-language`, `credential-request-language`, `free-email-brand-impersonation`, `link-ip-as-host`, `link-suspicious-tld`, `link-punycode-host`, `auth-spf-fail`, `auth-dkim-fail`, `auth-dmarc-fail`, `model-flagged`, `model-cleared`. Heuristic-conclusive cases skip the AI; everything else is bundled with the heuristic hints and sent to Claude Haiku for a final verdict.

Stream a Sonnet explanation for an email:

```bash
curl -N -X POST http://localhost:8787/explain/email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "PayPal Service <noreply@paypa1.com>",
    "subject": "Action required",
    "body": "Please verify your account.",
    "links": ["https://paypa1.com/login"],
    "verdict": "malicious",
    "confidence": 0.95,
    "reasons": [
      {"code": "link-typosquat-of-brand", "detail": "paypal.com (in link: https://paypa1.com/login)"}
    ]
  }'
```

Same SSE shape as `/explain/url`. Two- to three-paragraph educational stream that walks the reader through what's off about the email, the wider phishing pattern, and what to do next.

## License

MIT — see [LICENSE](LICENSE).
