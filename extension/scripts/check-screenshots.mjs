// Checks a folder of Web Store images against the store's rules and,
// with --fix, writes compliant copies to <dir>/out/.
//
//   node scripts/check-screenshots.mjs ../store/screenshots
//   node scripts/check-screenshots.mjs ../store/screenshots --fix
//
// Rules (Chrome Web Store, developer dashboard):
//   screenshots  1280x800 or 640x400, PNG without alpha or JPEG
//   promo tiles  440x280 (small, required) or 1400x560 (marquee)
// A capture is treated as a screenshot when its aspect is 16:10 and as a
// promo tile when it is 11:7 or 5:2; anything else is reported and, with
// --fix, centre-cropped to 1280x800 with a warning. Alpha is flattened
// onto the Watcher ink colour so a transparent capture doesn't come out
// with a white or black halo. Metadata is dropped on write.
import { mkdir, readdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import sharp from "sharp";

const INK = "#120a1f";
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

// [width, height, label]. Order matters: the first match wins.
const SIZES = [
  [1280, 800, "screenshot"],
  [640, 400, "screenshot"],
  [440, 280, "small promo tile"],
  [1400, 560, "marquee"],
];

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const dirArg = args.find((a) => !a.startsWith("--"));
if (!dirArg) {
  console.error("usage: node scripts/check-screenshots.mjs <dir> [--fix]");
  process.exit(2);
}
const dir = resolve(dirArg);
const outDir = join(dir, "out");

function ratio(w, h) {
  return w / h;
}

// Which target a capture should become, judged by aspect ratio with a
// little slack for off-by-one window sizing.
function targetFor(w, h) {
  const r = ratio(w, h);
  const near = (a, b) => Math.abs(a - b) < 0.01;
  if (near(r, 16 / 10)) return { w: 1280, h: 800, label: "screenshot", exact: true };
  if (near(r, 11 / 7)) return { w: 440, h: 280, label: "small promo tile", exact: true };
  if (near(r, 5 / 2)) return { w: 1400, h: 560, label: "marquee", exact: true };
  return { w: 1280, h: 800, label: "screenshot", exact: false };
}

const entries = (await readdir(dir, { withFileTypes: true }))
  .filter((e) => e.isFile() && IMAGE_EXT.has(extname(e.name).toLowerCase()))
  .map((e) => e.name)
  .sort();

if (entries.length === 0) {
  console.log(`No images in ${dir}`);
  process.exit(0);
}

let problems = 0;
if (fix) await mkdir(outDir, { recursive: true });

for (const name of entries) {
  const file = join(dir, name);
  const meta = await sharp(file).metadata();
  const { width: w, height: h, hasAlpha, format } = meta;
  const issues = [];

  const accepted = SIZES.find(([sw, sh]) => sw === w && sh === h);
  if (!accepted) issues.push(`size ${w}x${h}`);
  if (hasAlpha) issues.push("has alpha channel");
  if (format !== "png" && format !== "jpeg") issues.push(`format ${format}`);

  if (issues.length === 0) {
    console.log(`ok    ${name}  ${w}x${h} ${accepted[2]}`);
    continue;
  }

  problems += 1;
  const target = targetFor(w, h);
  const plan = target.exact
    ? `-> ${target.w}x${target.h} ${target.label}`
    : `-> ${target.w}x${target.h} CROPPED (aspect ${ratio(w, h).toFixed(3)} is not 16:10; recapture is better)`;
  console.log(`fix   ${name}  ${issues.join(", ")}  ${plan}`);

  if (!fix) continue;
  const outName = `${basename(name, extname(name))}.png`;
  await sharp(file)
    .resize(target.w, target.h, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
    .flatten({ background: INK })
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, outName));
  console.log(`      wrote out/${outName}`);
}

if (problems === 0) {
  console.log("\nAll images are ready to upload.");
} else if (fix) {
  console.log(`\n${problems} file(s) rewritten into ${outDir}. Upload from there.`);
} else {
  console.log(`\n${problems} file(s) need attention. Re-run with --fix to write corrected copies.`);
  process.exit(1);
}
