# Watcher mascot masters

Source-of-truth art for the Watcher character, 2048x2048 RGBA PNG with
a transparent background. These do **not** ship in the extension; the
rendered sizes in `extension/public/mascot/` do. Art direction and the
palette derived from it live in `design/design-direction.html`.

| Master         | Used for                              | Rendered as                              |
|----------------|---------------------------------------|------------------------------------------|
| calm-face.png  | Side panel + options page header      | calm-face@1x (44px), @2x (88px)          |
| stop-pose.png  | Warning interstitial, hand-out pose   | stop-pose@1x (96px), @2x (192px)         |
| thinking.png   | Loading / analyzing state (reserved)  | thinking@1x (80px), @2x (160px)          |
| icon.png       | Toolbar icon, simplified face         | icon-16, icon-32, icon-48, icon-128      |

## Re-rendering

```bash
cd extension
pnpm render-mascot
```

`extension/scripts/render-mascot.mjs` trims each master to its visible
bounds, pads it back to a square with a 6% margin, and resizes with
Lanczos resampling (sharp). Outputs are committed, so this only needs to
run when a master changes. Vite copies `extension/public/` to the root
of `dist/`, so the pages reference the art as `/mascot/<name>.png`.
