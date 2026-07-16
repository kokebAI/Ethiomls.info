import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Downloads the first listing image, compresses to WebP, and stamps a
 * diagonal EthioMLS watermark for Telegram card attachments.
 */
export async function buildWatermarkedListingWebp(
  imageUrl: string | null | undefined,
  listingId: string,
): Promise<{ buffer: Buffer; filename: string } | null> {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const input = Buffer.from(await response.arrayBuffer());

    const base = sharp(input).rotate().resize({
      width: 1280,
      height: 720,
      fit: "cover",
      withoutEnlargement: true,
    });

    const { width = 1280, height = 720 } = await base.metadata();
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .wm {
              fill: rgba(255,255,255,0.42);
              font-size: ${Math.max(28, Math.round(width * 0.045))}px;
              font-family: Arial, sans-serif;
              font-weight: 700;
              letter-spacing: 0.08em;
            }
          </style>
        </defs>
        <g transform="translate(${width / 2}, ${height / 2}) rotate(-32)">
          <text class="wm" text-anchor="middle" dominant-baseline="middle">EthioMLS</text>
        </g>
      </svg>
    `;

    const buffer = await base
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .webp({ quality: 78 })
      .toBuffer();

    const hash = createHash("sha1").update(listingId).digest("hex").slice(0, 8);
    const filename = `ethiomls-${listingId.slice(0, 8)}-${hash}.webp`;

    const cacheDir = path.join(process.cwd(), ".cache", "broadcast");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(path.join(cacheDir, filename), buffer);

    return { buffer, filename };
  } catch (error) {
    console.warn("[listing-image] watermark failed", error);
    return null;
  }
}
