/**
 * Like export-scrape-reviews-for-agt-crm.ts but includes rows already tagged
 * migrated-to-agt-crm (CRM import dedupes by ethiomls_listing_id / fingerprint).
 *
 *   npx tsx scripts/export-scrape-reviews-for-agt-crm-force.ts > /tmp/agt-scrape-force.json
 */
import { createHash } from "node:crypto";
import { ListingStatus, NotificationStatus } from "@prisma/client";
import { prisma } from "../lib/db/prisma";

function contentFingerprint(text: string): string {
  return createHash("sha256")
    .update(text.replace(/\s+/g, " ").trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
}

async function main() {
  const pending = await prisma.listing.findMany({
    where: {
      status: ListingStatus.PENDING_REVIEW,
      OR: [
        { scrapedRawText: { not: null } },
        { importSourceId: { not: null } },
        { sourceUrl: { not: null } },
        { metadataTags: { has: "import" } },
        { metadataTags: { has: "sales-kit-import" } },
        {
          notificationStatus: {
            in: [
              NotificationStatus.PENDING_REVIEW,
              NotificationStatus.FAILED,
              NotificationStatus.DISCARDED,
            ],
          },
        },
      ],
    },
    orderBy: [{ sourcePostedAt: "asc" }, { createdAt: "asc" }],
    take: 5000,
    include: {
      importSource: {
        select: {
          id: true,
          label: true,
          normalizedUrl: true,
          sourceType: true,
          url: true,
          telegramHandle: true,
        },
      },
      subCity: { select: { code: true } },
    },
  });

  const listings = pending.map((listing) => {
    const raw =
      listing.scrapedRawText?.trim() ||
      [listing.titleEn, listing.titleAm, listing.descriptionEn, listing.contactPhone]
        .filter(Boolean)
        .join("\n");
    return {
      ethiomlsListingId: listing.id,
      title: listing.titleEn || listing.titleAm || "Untitled",
      description: listing.descriptionEn || listing.descriptionAm || "",
      listingType: listing.listingType,
      category: listing.category,
      priceAmount: listing.priceAmount.toString(),
      priceCurrency: listing.priceCurrency,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      floorAreaSqm: listing.floorAreaSqm?.toString() ?? null,
      subcityCode: listing.subCity?.code ?? null,
      addressLine: listing.addressLine,
      contactPhone: listing.contactPhone,
      contactName: listing.contactName,
      sourceUrl: listing.sourceUrl,
      sourceExternalId: listing.sourceExternalId,
      sourcePostedAt: listing.sourcePostedAt?.toISOString() ?? null,
      scrapedRawText: listing.scrapedRawText,
      imageUrls: listing.images?.length
        ? listing.images
        : listing.galleryImageUrls ?? [],
      contentFingerprint: contentFingerprint(raw || listing.id),
      notificationStatus: listing.notificationStatus,
      metadataTags: listing.metadataTags,
      createdAt: listing.createdAt.toISOString(),
      importSource: listing.importSource
        ? {
            ethiomlsId: listing.importSource.id,
            label: listing.importSource.label,
            normalizedUrl: listing.importSource.normalizedUrl,
            sourceType: listing.importSource.sourceType,
            url: listing.importSource.url,
            telegramHandle: listing.importSource.telegramHandle,
          }
        : null,
    };
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        count: listings.length,
        forced: true,
        listings,
      },
      null,
      2,
    )}\n`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
