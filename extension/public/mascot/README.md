# Mascot assets

Watcher character art for the extension UI. Generated from the user's
reference sticker sheet; see WhyShield-Gemini-Art-Brief.md in Documents.

Expected files (PNG, transparent background, square, >= 1024px source):

| File            | Use                                   | Rendered size |
|-----------------|---------------------------------------|---------------|
| calm-face.png   | Side panel + options page header      | 44x44         |
| stop-pose.png   | Warning interstitial, hand-out pose   | 96x96         |
| thinking.png    | Loading / analyzing state             | 80x80         |
| icon.png        | Toolbar icon, simplified face         | 16x16, 32x32  |

Vite copies everything in public/ to dist/ root, so these land at
dist/mascot/*.png and are referenced as /mascot/<name>.png from the
warning, side panel, and options pages.
