import { ListingStatus } from "@prisma/client";

/** Tag written by POST /api/crm/ingest-listing — marks CRM scrape activations. */
export const CRM_PUBLIC_SCRAPE_TAG = "agt-crm-activation";

export type CrmScrapeListingRef = {
  status: string;
  metadataTags?: string[] | null;
};

/** CRM-ingested scrapes that may appear on the public catalog while unverified. */
export function isPublicCrmUnverifiedScrape(
  listing: CrmScrapeListingRef,
): boolean {
  if (listing.status !== ListingStatus.PENDING_REVIEW) return false;
  return (listing.metadataTags ?? []).includes(CRM_PUBLIC_SCRAPE_TAG);
}

/** Prisma `where` for public catalog listings (published + CRM unverified scrapes). */
export function publicCatalogListingWhere() {
  return {
    OR: [
      { status: ListingStatus.PUBLISHED },
      {
        status: ListingStatus.PENDING_REVIEW,
        metadataTags: { has: CRM_PUBLIC_SCRAPE_TAG },
      },
    ],
  };
}
