# Screenshots and promo images

The store requires at least one screenshot and strongly weights listings
with five. Sizes the store accepts: **1280×800** or **640×400**, PNG
(24-bit, no alpha) or JPEG. Use 1280×800 for all of them; on a HiDPI
display capture at 2560×1600 and let the checker downscale.

Validate and fix a folder of captures with:

```
cd extension
node scripts/check-screenshots.mjs ../store/screenshots           # report only
node scripts/check-screenshots.mjs ../store/screenshots --fix     # also write 1280x800 copies to ../store/screenshots/out
```

The checker rejects anything that is not 16:10, flattens transparency
onto the Watcher ink colour, and strips metadata. Upload the files from
`out/`. The `store/screenshots/` folder is gitignored; captures show a
Gmail inbox, even a test one, and do not belong in the repository.

## Window setup

1. Build the production bundle (`pnpm build` in `/extension`) and load
   `extension/dist` unpacked, or use the packaged zip. The production
   build points at the live worker; the screenshots must show real
   verdicts, not localhost.
2. Open a fresh Chrome window and size it to exactly 1280×800 of
   *viewport*. Easiest: DevTools → toggle device toolbar → Responsive →
   type 1280 × 800, then close DevTools and capture the tab with
   DevTools' "Capture screenshot" command, or use a window-sizing
   extension. Alternatively launch with
   `chrome --window-size=1280,880 --new-window` (the extra height
   absorbs the tab strip and address bar) and capture the content area.
3. Light or dark Chrome theme both work; the extension's surfaces carry
   their own palette. Hide bookmarks bar. No other extensions visible on
   the toolbar except WhyShield, pinned.
4. Sign the browser profile into the **bluewatcher** test Gmail account
   only. Never capture a real inbox.

## The five frames

Order matters: the first image is the one shown in search results and
on the listing's hero slot.

### 1. Warning page, look-alike domain

- Navigate to `http://paypa1.com/login` (the typosquat test case; it
  resolves to a parked page but WhyShield redirects before that loads).
- Capture the full warning page: crimson band, Watcher stop pose, the
  headline, the address with the `paypa1` segment underlined, and all
  three buttons.
- Nothing else on screen. This frame is the pitch.

### 2. Side panel, explanation streaming

- From frame 1, click **Explain why**. Wait until the explanation has
  finished streaming (the cursor disappears and the mascot settles into
  the breathe loop), then capture with the warning page still in the
  tab and the panel open on the right.
- If Chrome's side panel is narrower than ~360px, widen it by dragging
  the divider so both paragraphs fit without a scrollbar.

### 3. Gmail banner

- In the bluewatcher inbox, open the seeded phishing test email (the
  one from the "PayPal Support" look-alike sender with the urgency line
  and the `paypa1.com` link; recipe in `extension/README.md`).
- Capture with the message open and the gold or crimson banner visible
  above the message body. Make sure the banner's three buttons are in
  frame. Blur nothing; the test account has no real mail.

### 4. Side panel, email explanation

- From frame 3, click **Explain why** on the banner. Let it finish, then
  capture Gmail plus the open panel. The panel header should show the
  sender and subject under the badge.

### 5. Settings page

- Right-click the toolbar icon → **Options**. Capture the page with both
  toggles on, sensitivity at the default, two or three hosts in Trusted
  sites (use `google.com`, `github.com`, `your-bank.example`), and the
  API key field empty.
- Zoom the page to 110% if the 1280 viewport leaves too much empty
  margin; the capture must still be 1280×800.

## Promo images

- **Small promo tile, 440×280, required.** Watcher stop pose on the ink
  background, "WhyShield" in Space Grotesk, no tagline (too small to
  read). `scripts/make-promo.mjs` would compose this from
  `design/mascot/hero-stop.png`; that master does not exist yet, so the
  script was not written. Until there is a hero render, compose the tile
  by hand from `extension/public/mascot/stop-pose@2x.png` on `#120a1f`
  and run it through the checker (it accepts 440×280 as a promo size).
- **Marquee, 1400×560, optional.** Skip for the first submission.

## Alt text

The dashboard does not take alt text, but keep these as the captions in
the README screenshot section:

1. WhyShield stops a visit to paypa1.com and shows which letter is wrong.
2. The side panel explains, in two paragraphs, why the address is a
   look-alike.
3. A banner above a Gmail message that shows signs of phishing.
4. The side panel explains what gave the email away.
5. Settings: warnings on or off, sensitivity, trusted sites, your own key.
