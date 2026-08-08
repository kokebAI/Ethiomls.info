import { ListingStatus } from "@prisma/client";

/** Tag written by POST /api/crm/ingest-listing — marks CRM scrape activations. */
export const CRM_PUBLIC_SCRAPE_TAG = "agt-crm-activation";

/** Tag on prisma seed demo-grid rows (PENDING_REVIEW personas). */
export const DEMO_PUBLIC_UNVERIFIED_TAG = "demo-grid";

export type CrmScrapeListingRef = {
  status: string;
  metadataTags?: string[] | null;
};

function hasPublicUnverifiedTag(tags: string[] | null | undefined): boolean {
  const list = tags ?? [];
  return (
    list.includes(CRM_PUBLIC_SCRAPE_TAG) ||
    list.includes(DEMO_PUBLIC_UNVERIFIED_TAG)
  );
}

/** Unverified rows allowed on the public catalog (CRM scrapes + demo seed grid). */
export function isPublicCrmUnverifiedScrape(
  listing: CrmScrapeListingRef,
): boolean {
  if (listing.status !== ListingStatus.PENDING_REVIEW) return false;
  return hasPublicUnverifiedTag(listing.metadataTags);
}

/** Prisma `where` for public catalog listings (published + public unverified). */
export function publicCatalogListingWhere() {
  return {
    OR: [
      { status: ListingStatus.PUBLISHED },
      {
        status: ListingStatus.PENDING_REVIEW,
        metadataTags: { has: CRM_PUBLIC_SCRAPE_TAG },
      },
      {
        status: ListingStatus.PENDING_REVIEW,
        metadataTags: { has: DEMO_PUBLIC_UNVERIFIED_TAG },
      },
    ],
  };
}
