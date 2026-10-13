// Renders the Watcher mascot masters in design/mascot/ down to the sizes
// the extension actually ships. Run with `pnpm render-mascot` from
// /extension. Outputs are committed; this script only needs to run again
// when a master changes.
//
// Each master is trimmed to its visible bounding box, padded back to a
// square with a small margin, then resized. Without the trim a 16px icon
// would spend a third of its pixels on empty transparent canvas.
import { mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../../design/mascot");
const OUT = resolve(here, "../public/mascot");

// Margin on each side, as a fraction of the trimmed content's longer edge.
const MARGIN = 0.06;

// name -> [[outputFile, pixelSize], ...]. @1x/@2x pairs for <img srcset>,
// plain sizes for the manifest icon set.
const TARGETS = {
  "calm-face": [
    ["calm-face@1x.png", 44],
    ["calm-face@2x.png", 88],
  ],
  "stop-pose": [
    ["stop-pose@1x.png", 96],
    ["stop-pose@2x.png", 192],
  ],
  thinking: [
    ["thinking@1x.png", 80],
    ["thinking@2x.png", 160],
  ],
  icon: [
    ["icon-16.png", 16],
    ["icon-32.png", 32],
    ["icon-48.png", 48],
    ["icon-128.png", 128],
  ],
};

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function squareTrimmed(file) {
  const trimmed = await sharp(file).trim({ threshold: 10 }).toBuffer();
  const { width, height } = await sharp(trimmed).metadata();
  const side = Math.ceil(Math.max(width, height) * (1 + 2 * MARGIN));
  const left = Math.floor((side - width) / 2);
  const top = Math.floor((side - height) / 2);
  return sharp(trimmed)
    .extend({
      top,
      bottom: side - height - top,
      left,
      right: side - width - left,
      background: transparent,
    })
    .toBuffer();
}

await mkdir(OUT, { recursive: true });

for (const [name, outputs] of Object.entries(TARGETS)) {
  const master = join(SRC, `${name}.png`);
  const square = await squareTrimmed(master);
  for (const [outFile, size] of outputs) {
    const dest = join(OUT, outFile);
    await sharp(square)
      .resize(size, size, {
        kernel: sharp.kernel.lanczos3,
        fit: "contain",
        background: transparent,
      })
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(dest);
    const { size: bytes } = await stat(dest);
    console.log(
      `${outFile.padEnd(20)} ${String(size).padStart(3)}px  ${(bytes / 1024).toFixed(1)} KB`,
    );
  }
}
