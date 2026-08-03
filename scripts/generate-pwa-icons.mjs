#!/usr/bin/env node
/**
 * Rasterize public/icons/icon.svg into PWA PNG icons (any + maskable).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const iconsDir = path.join(root, "public", "icons");
const svgPath = path.join(iconsDir, "icon.svg");
const SLATE = "#0F172A";

async function writeAny(size) {
  const out = path.join(iconsDir, `icon-${size}.png`);
  await sharp(await readFile(svgPath))
    .resize(size, size)
    .png()
    .toFile(out);
  console.log("wrote", path.relative(root, out));
}

async function writeMaskable(size) {
  // Keep mark inside the center ~80% safe zone for Android adaptive icons.
  const inset = Math.round(size * 0.8);
  const mark = await sharp(await readFile(svgPath))
    .resize(inset, inset)
    .png()
    .toBuffer();

  const out = path.join(iconsDir, `icon-${size}-maskable.png`);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: SLATE,
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(out);
  console.log("wrote", path.relative(root, out));
}

await mkdir(iconsDir, { recursive: true });
for (const size of [192, 512]) {
  await writeAny(size);
  await writeMaskable(size);
}
console.log("done");
