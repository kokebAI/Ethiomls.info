/**
 * Inspect + restore scraped listings into Scrape invite review.
 *
 * Usage:
 *   npx tsx scripts/restore-scrape-invite-queue.ts
 *   npx tsx scripts/restore-scrape-invite-queue.ts --all-pending
 */
import { ListingStatus, NotificationStatus } from "@prisma/client";
import { prisma } from "../lib/db/prisma";

async function main() {
  const allPending = process.argv.includes("--all-pending");

  const byNotif = await prisma.listing.groupBy({
    by: ["notificationStatus"],
    _count: { _all: true },
  });
  console.log(
    "notificationStatus counts:",
    Object.fromEntries(
      byNotif.map((row) => [row.notificationStatus, row._count._all]),
    ),
  );

  const alreadyQueued = await prisma.listing.count({
    where: { notificationStatus: NotificationStatus.PENDING_REVIEW },
  });
  console.log(`already in scrape queue: ${alreadyQueued}`);

  const naPending = await prisma.listing.findMany({
    where: {
      notificationStatus: NotificationStatus.NOT_APPLICABLE,
      status: ListingStatus.PENDING_REVIEW,
    },
    select: {
      id: true,
      titleEn: true,
      contactPhone: true,
      scrapedRawText: true,
      importSourceId: true,
      sourceUrl: true,
      sourceExternalId: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  console.log(
    `NOT_APPLICABLE + PENDING_REVIEW sample (${naPending.length} shown):`,
  );
  for (const row of naPending) {
    console.log(
      `  ${row.id} raw=${Boolean(row.scrapedRawText)} import=${Boolean(row.importSourceId)} src=${Boolean(row.sourceUrl)} phone=${row.contactPhone ?? "—"} ${row.titleEn?.slice(0, 50) ?? ""}`,
    );
  }

  const where = allPending
    ? {
        notificationStatus: NotificationStatus.NOT_APPLICABLE,
        status: ListingStatus.PENDING_REVIEW,
      }
    : {
        notificationStatus: NotificationStatus.NOT_APPLICABLE,
        status: ListingStatus.PENDING_REVIEW,
        OR: [
          { scrapedRawText: { not: null } },
          { importSourceId: { not: null } },
          { sourceExternalId: { not: null } },
          { sourceUrl: { not: null } },
        ],
      };

  const result = await prisma.listing.updateMany({
    where,
    data: {
      notificationStatus: NotificationStatus.PENDING_REVIEW,
      notificationError: null,
    },
  });

  console.log(
    `Restored ${result.count} listing(s) to scrape invite queue${
      allPending ? " (--all-pending)" : ""
    }.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
