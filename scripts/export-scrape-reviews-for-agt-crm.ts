/**
 * Export EthioMLS scrape-review queue for AGT CRM (with provenance for dedupe).
 *
 *   npx tsx scripts/export-scrape-reviews-for-agt-crm.ts > /tmp/agt-scrape-reviews.json
 *   npx tsx scripts/export-scrape-reviews-for-agt-crm.ts --mark > /tmp/agt-scrape-reviews.json
 *
 * Then on AGT CRM:
 *   npx tsx scripts/import-scrape-reviews-from-json.ts /tmp/agt-scrape-reviews.json
 */
import { createHash } from "node:crypto";
import { ListingStatus, NotificationStatus } from "@prisma/client";
import { prisma } from "../lib/db/prisma";

const mark = process.argv.includes("--mark");

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

  if (mark && listings.length > 0) {
    const ids = listings.map((l) => l.ethiomlsListingId);
    for (const id of ids) {
      const row = pending.find((p) => p.id === id);
      if (!row) continue;
      const tags = Array.from(
        new Set([...row.metadataTags, "migrated-to-agt-crm"]),
      );
      await prisma.listing.update({
        where: { id },
        data: {
          notificationStatus: NotificationStatus.DISCARDED,
          metadataTags: tags,
          notificationError: "Migrated to AGT CRM scrape hub",
        },
      });
    }
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    count: listings.length,
    markedMigrated: mark,
    listings,
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
