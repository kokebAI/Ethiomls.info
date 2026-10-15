import type { AgtCrmEthiomlsListingPayload } from "@/lib/crm/register-ethiomls-listing";
import {
  ingestAgtCrmListing,
  type IngestAgtCrmListingResult,
} from "@/lib/crm/ingest-listing";

/**
 * Copy a scrape that was just accepted by AGT CRM into the EthioMLS catalog.
 *
 * SCRAPE_DESTINATION=crm still posts to CRM Review. The public pages only
 * read this database, and nothing else was calling ingest, so mls.et stayed
 * empty. The mirrored row is PENDING_REVIEW tagged `agt-crm-activation` —
 * the same shape POST /api/crm/ingest-listing writes — so /listings can show
 * it while CRM keeps the review copy.
 */
export async function mirrorRegisteredScrapeToCatalog(input: {
  payload: AgtCrmEthiomlsListingPayload;
  crmPropertyId?: string | null;
}): Promise<IngestAgtCrmListingResult> {
  const crmPropertyId =
    input.crmPropertyId?.trim() || input.payload.externalId.trim();

  try {
    return await ingestAgtCrmListing({
      crmPropertyId,
      title: input.payload.title,
      description: input.payload.description,
      scrapedRawText: input.payload.scrapedRawText,
      contactPhone: input.payload.contactPhone,
      contactName: input.payload.contactName,
      listingType: input.payload.listingType,
      category: input.payload.category,
      priceAmount: input.payload.priceAmount,
      priceCurrency: input.payload.priceCurrency,
      bedrooms: input.payload.bedrooms,
      bathrooms: input.payload.bathrooms,
      floorAreaSqm: input.payload.floorAreaSqm,
      addressLine: input.payload.addressLine,
      subCityCode: input.payload.subcityCode,
      imageUrls: input.payload.imageUrls,
      sourceUrl: input.payload.sourceUrl,
      sourcePostedAt: input.payload.postedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Local catalog mirror failed";
    return { ok: false, error: message, status: 500 };
  }
}
