# Chrome Web Store submission checklist

In order. Each step names the file or command it depends on. Tick as you
go; the first submission goes out **Unlisted**, and the listing is
switched to Public only after a round of installs from the unlisted link.

## Before the store

- [ ] **Cloudflare Workers Paid plan** on the account that owns
      `whyshield-backend`. The free tier's 1,000 KV writes a day cannot
      carry public traffic: past the cap, caching and the KV layer of
      rate limiting fail open. ($5/month.)
- [ ] **Anthropic spending cap.** Set a hard monthly limit on the
      Anthropic account that holds the shared key, in the console under
      Billing → Limits. Pick the number you are willing to lose if the
      rate limiter is wrong.
- [ ] **Deploy the worker** with the privacy and about pages:
      `cd backend && npx wrangler deploy`. Then open
      `https://whyshield-backend.knower.workers.dev/privacy` and check
      the date at the top matches `store/privacy-policy.md`.
- [ ] **Repo decision applied** (decided in session 8b: public). Confirm
      `CLAUDE.md` and `.claude/` are no longer tracked (`git ls-files
      CLAUDE.md .claude` prints nothing), `docs/ARCHITECTURE.md` exists,
      and the GitHub repo is set to Public. The listing, the policy, and
      the manifest all link to it.
- [ ] **Screenshots.** Follow `store/screenshots.md`, five frames, run
      `node scripts/check-screenshots.mjs ../store/screenshots --fix`
      from `/extension`, upload from `out/`.
- [ ] **Small promo tile** 440×280 (see the promo section of
      `screenshots.md`).
- [ ] **Package:** `cd extension && pnpm package`. Confirms the build,
      writes `extension/release/whyshield-1.0.0.zip`, prints the file
      list. Check the list has no `.map`, `.vite/`, or README entries.

## Developer account

- [ ] Register at <https://chrome.google.com/webstore/devconsole> with
      the Google account that will own the listing. One-time $5 fee.
- [ ] Account tab: set the **developer email** that the store shows on
      the listing (it is public). Verify it when the mail arrives.
- [ ] Enable two-step verification on that Google account; the store
      requires it to publish.

## The listing

- [ ] **New item** → upload `whyshield-1.0.0.zip`.
- [ ] **Store listing tab**, from `store/listing.md`: name, summary
      (identical to the manifest description), description (paste the
      plain-text block), category Privacy & Security, language English
      (US).
- [ ] Upload the five screenshots and the promo tile.
- [ ] Homepage URL and support URL (GitHub repo and its issues page).
- [ ] **Privacy practices tab**, from `store/data-disclosure.md`:
      single-purpose text, one justification per permission and for the
      Gmail host match (sentences are in `store/permissions.md`),
      remote code: No, data usage ticks (authentication information,
      personal communications, web history, website content), all three
      certifications, privacy policy URL
      `https://whyshield-backend.knower.workers.dev/privacy`.
- [ ] **Distribution tab:** visibility **Unlisted**, all regions, free.
- [ ] Save draft, re-read every field once against the files. Submit for
      review.

## After submission

- [ ] Review usually takes one to three days for a new item; permission
      questions arrive by email. Reply using the template at the bottom
      of `store/permissions.md`.
- [ ] Once published (unlisted), install from the store link on a
      profile that does not have the unpacked build. Walk the five
      screenshot scenarios for real. Confirm the toolbar icon, the
      warning on `paypa1.com`, the Gmail banner on the test account, both
      side-panel explanations, and the settings page.
- [ ] Watch the worker for a day: `cd backend && npx wrangler tail`
      shows live requests (pretty mode only: it prints method, path, and
      status; never use `--format json`, which includes request headers,
      and never pipe tail output to a file, or the "writes no logs" line
      in the policy stops being true); the Cloudflare dashboard shows
      request counts and KV write usage.
- [ ] Switch **Distribution → Public**. No re-review is needed for a
      visibility change.
- [ ] Add the store link and the five screenshot captions to the root
      `README.md`.
- [ ] Tag the commit: `git tag v1.0.0 && git push --tags`.

## Each later release

1. Bump `version` in `extension/manifest.config.ts` and
   `extension/package.json`.
2. If data handling changed, update `store/privacy-policy.md`, the
   HTML in `backend/src/pages.ts`, and `store/data-disclosure.md`; deploy
   the worker first so the policy is live before the extension is.
3. `pnpm package`, upload the new zip on the existing item, submit.
