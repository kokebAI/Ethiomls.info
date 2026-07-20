import { prisma } from "@/lib/db/prisma";

/**
 * Hard-delete scraped listings and related rows that would otherwise block
 * `listing.delete` / `deleteMany` (non-cascading FKs).
 */
async function deleteListingsByIds(listingIds: string[]): Promise<number> {
  if (listingIds.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.adminAlert.deleteMany({ where: { listingId: { in: listingIds } } });
    await tx.lead.deleteMany({ where: { listingId: { in: listingIds } } });
    await tx.listingEvidence.deleteMany({
      where: { listingId: { in: listingIds } },
    });
    await tx.escrowAccount.deleteMany({
      where: { listingId: { in: listingIds } },
    });
    await tx.foreignInvestorClearance.deleteMany({
      where: { listingId: { in: listingIds } },
    });
    // Detach any unit-stack children pointing at these parents first.
    await tx.listing.updateMany({
      where: { parentId: { in: listingIds } },
      data: { parentId: null },
    });
    await tx.listing.deleteMany({ where: { id: { in: listingIds } } });
  });

  return listingIds.length;
}

/** Permanently remove one scraped listing and its invite/audit junk rows. */
export async function hardDeleteScrapedListing(listingId: string): Promise<{
  deleted: boolean;
}> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, importSourceId: true, scrapedRawText: true },
  });
  if (!listing) return { deleted: false };

  await deleteListingsByIds([listing.id]);
  return { deleted: true };
}

/**
 * Delete an import source, its scrape runs, and every listing imported from it.
 * Curated project inventory (no importSourceId) is left untouched.
 */
export async function deleteImportSourceAndScrapes(importSourceId: string): Promise<{
  deletedSource: boolean;
  listingsDeleted: number;
  runsDeleted: number;
}> {
  const source = await prisma.importSource.findUnique({
    where: { id: importSourceId },
    select: { id: true },
  });
  if (!source) {
    return { deletedSource: false, listingsDeleted: 0, runsDeleted: 0 };
  }

  const listings = await prisma.listing.findMany({
    where: { importSourceId },
    select: { id: true },
  });
  const listingIds = listings.map((row) => row.id);
  const listingsDeleted = await deleteListingsByIds(listingIds);

  const runs = await prisma.scrapeRun.deleteMany({
    where: { importSourceId },
  });

  await prisma.importSource.delete({ where: { id: importSourceId } });

  return {
    deletedSource: true,
    listingsDeleted,
    runsDeleted: runs.count,
  };
}
