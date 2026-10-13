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
  -H "X-WhyShield-Install: dev-curl-00000000" \
  -d '{"url":"https://paypa1.com/login"}'
```

The `X-WhyShield-Install` header is required on every `/analyze/*` and `/explain/*` call. The extension sends a random per-install UUID; for curl any 8–64 character string of letters, digits, and dashes works. Requests without it get `400 { "error": "missing-install-id" }`. Each id gets 200 analyze and 50 explain calls per UTC hour, after which the backend answers `429 { "error": "rate-limited" }`.

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
  -H "X-WhyShield-Install: dev-curl-00000000" \
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
  -H "X-WhyShield-Install: dev-curl-00000000" \
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
  -H "X-WhyShield-Install: dev-curl-00000000" \
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

## Deploying

The reference backend runs at `https://whyshield-backend.knower.workers.dev`. A production build of the extension (`pnpm build` in `/extension`) points there by default; `pnpm dev` points at `http://localhost:8787`. Vite's mode decides, nothing to toggle by hand. The settings page can override either.

To run your own copy on Cloudflare Workers (free plan is enough to start):

1. `cd backend && npx wrangler login` — opens a browser for Cloudflare OAuth.
2. `npx wrangler kv namespace create VERDICT_CACHE` — copy the printed `id` into the `[[kv_namespaces]]` block in `backend/wrangler.toml`.
3. `npx wrangler secret put ANTHROPIC_API_KEY` — paste your Anthropic key when prompted. It is stored encrypted on Cloudflare and never written to a file. If wrangler asks to create the Worker first, say yes.
4. `npx wrangler deploy` — on a fresh account it asks you to register a `workers.dev` subdomain; pick one. It then prints your URL.
5. Put that URL in `PRODUCTION_BACKEND_URL` in `extension/src/shared/config.ts` and rebuild the extension.

Things worth knowing:

- **Rate limits.** Each extension install gets 200 `/analyze/*` and 50 `/explain/*` requests per UTC hour, keyed by a random per-install UUID sent as `X-WhyShield-Install`. Over the limit returns `429 { "error": "rate-limited" }` and the extension waits for the next hour. Counting uses an in-memory layer per worker plus KV, so it's approximate under bursts from many locations but reliable for the common case.
- **KV free tier allows 1,000 writes per day.** Every counted request is one write. Fine for development; move to Workers Paid before inviting users, or caching and the KV half of rate limiting will silently fail open past the cap (memory still counts).
- **Inspecting production KV.** Wrangler 4's `kv key list` and `kv key get` default to the local dev store. Add `--remote` to see the live namespace.
- **Rolling back.** `npx wrangler rollback` returns to the previous version. `npx wrangler delete` removes the worker entirely.

## License

MIT — see [LICENSE](LICENSE).
