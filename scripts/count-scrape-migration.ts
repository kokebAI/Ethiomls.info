import { ListingStatus, NotificationStatus } from "@prisma/client";
import { prisma } from "../lib/db/prisma";

async function main() {
  const pending = await prisma.listing.count({
    where: { status: ListingStatus.PENDING_REVIEW },
  });
  const migrated = await prisma.listing.count({
    where: { metadataTags: { has: "migrated-to-agt-crm" } },
  });
  const queueLike = await prisma.listing.count({
    where: {
      status: ListingStatus.PENDING_REVIEW,
      OR: [
        { scrapedRawText: { not: null } },
        { importSourceId: { not: null } },
        { metadataTags: { has: "import" } },
      ],
    },
  });
  const exportable = await prisma.listing.count({
    where: {
      status: ListingStatus.PENDING_REVIEW,
      AND: [
        {
          OR: [
            {
              notificationStatus: {
                in: [
                  NotificationStatus.PENDING_REVIEW,
                  NotificationStatus.FAILED,
                ],
              },
            },
            {
              notificationStatus: NotificationStatus.NOT_APPLICABLE,
              OR: [
                { importSourceId: { not: null } },
                { scrapedRawText: { not: null } },
                { metadataTags: { has: "import" } },
                { metadataTags: { has: "sales-kit-import" } },
              ],
            },
          ],
        },
        {
          OR: [
            { scrapedRawText: { not: null } },
            { importSourceId: { not: null } },
            { sourceUrl: { not: null } },
            { metadataTags: { has: "import" } },
            { metadataTags: { has: "sales-kit-import" } },
          ],
        },
        { NOT: { metadataTags: { has: "migrated-to-agt-crm" } } },
      ],
    },
  });
  console.log(
    JSON.stringify(
      { pendingReview: pending, taggedMigrated: migrated, queueLikePending: queueLike, exportable },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
