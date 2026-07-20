import "dotenv/config";
import { prisma } from "@/lib/db/prisma";
import { fetchPublicText } from "@/lib/imports/fetch-safe";

const TELEGRAM_POST_RE =
  /^https?:\/\/(?:t\.me|telegram\.me)\/([^/]+)\/(\d+)/i;

function parseTelegramDatetime(html: string): Date | null {
  const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  if (!timeMatch?.[1]) return null;
  const parsed = new Date(timeMatch[1]);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const rows = await prisma.listing.findMany({
    where: {
      sourcePostedAt: null,
      sourceUrl: { not: null },
    },
    select: { id: true, sourceUrl: true },
    take: 500,
    orderBy: { createdAt: "asc" },
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const url = row.sourceUrl?.trim();
    if (!url) {
      skipped += 1;
      continue;
    }

    const match = url.match(TELEGRAM_POST_RE);
    if (!match) {
      skipped += 1;
      continue;
    }

    const [, channel, postId] = match;
    const previewUrl = `https://t.me/${channel}/${postId}?embed=1`;

    try {
      const { html } = await fetchPublicText(previewUrl);
      const postedAt = parseTelegramDatetime(html);
      if (!postedAt) {
        failed += 1;
        console.warn(`[backfill] no datetime for ${row.id} (${url})`);
        continue;
      }

      await prisma.listing.update({
        where: { id: row.id },
        data: { sourcePostedAt: postedAt },
      });
      updated += 1;
      console.log(`[backfill] ${row.id} → ${postedAt.toISOString()}`);
    } catch (error) {
      failed += 1;
      console.warn(
        `[backfill] failed ${row.id}:`,
        error instanceof Error ? error.message : error,
      );
    }

    await sleep(400);
  }

  console.log(
    JSON.stringify({ scanned: rows.length, updated, skipped, failed }, null, 2),
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
