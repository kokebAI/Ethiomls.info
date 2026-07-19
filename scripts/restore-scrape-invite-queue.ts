/**
 * Move all import/scrape listings into Scrape invite review
 * (notificationStatus = PENDING_REVIEW) so they can be SMS-reviewed.
 *
 * Usage: npx tsx scripts/restore-scrape-invite-queue.ts
 */
import { ListingStatus, NotificationStatus } from "@prisma/client";
import { prisma } from "../lib/db/prisma";

async function main() {
  const where = {
    status: ListingStatus.PENDING_REVIEW,
    notificationStatus: {
      in: [NotificationStatus.NOT_APPLICABLE, NotificationStatus.FAILED],
    },
    OR: [
      { scrapedRawText: { not: null } },
      { importSourceId: { not: null } },
      { sourceExternalId: { not: null } },
      { sourceUrl: { not: null } },
      { metadataTags: { has: "import" } },
      { metadataTags: { has: "sales-kit-import" } },
    ],
  } as const;

  const preview = await prisma.listing.findMany({
    where,
    select: {
      id: true,
      titleEn: true,
      contactPhone: true,
      createdAt: true,
      notificationStatus: true,
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  console.log(`Found ${preview.length} import/scrape listing(s) to queue:`);
  for (const row of preview) {
    const ageDays = Math.floor(
      (Date.now() - row.createdAt.getTime()) / 86_400_000,
    );
    console.log(
      `  ${row.id}  ${ageDays}d  ${row.notificationStatus}  phone=${row.contactPhone ?? "—"}  ${row.titleEn ?? ""}`,
    );
  }

  const result = await prisma.listing.updateMany({
    where,
    data: {
      notificationStatus: NotificationStatus.PENDING_REVIEW,
      notificationError: null,
    },
  });

  const queued = await prisma.listing.count({
    where: { notificationStatus: NotificationStatus.PENDING_REVIEW },
  });
  console.log(`Restored ${result.count}. Scrape queue now: ${queued}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
