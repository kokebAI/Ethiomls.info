import { prisma } from "@/lib/db/prisma";
import { publicCatalogListingWhere } from "@/lib/catalog/crm-public-scrape";
import { teaserCoverPhotos } from "@/lib/catalog/buyer-visibility";
import type { PriceCurrency } from "@/lib/catalog/price-band";
import { resolveNbeUsdEtbRate } from "@/lib/compliance/currency";
import { formatListingPriceBand } from "@/lib/currency/preference";
import { readDisplayCurrencyPreference } from "@/lib/currency/server";

export type HomeTeaser = {
  id: string;
  title: Record<string, string>;
  listingType: string;
  subCityCode: string | null;
  subCityName: Record<string, string> | null;
  priceAmount: number;
  priceCurrency: string;
  imageUrl: string | null;
  priceBand: string;
};

/**
 * Home gateway teasers. Same public set as /listings (published, CRM
 * activations, and demo-grid seed rows) so a CRM mirror is visible on /.
 */
export async function fetchHomeTeasers(
  limit = 3,
): Promise<{ teasers: HomeTeaser[]; unavailable: boolean }> {
  try {
    const { currency: preferredCurrency, rateUsdEtb } =
      await readDisplayCurrencyPreference();
    const rate = resolveNbeUsdEtbRate(rateUsdEtb);
    const listings = await prisma.listing.findMany({
      where: publicCatalogListingWhere(),
      include: {
        subCity: { select: { code: true, name: true } },
      },
      orderBy: [
        { publishedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: limit,
    });

    const teasers = listings.map((listing) => {
      const amount = Number(listing.priceAmount);
      const currency = listing.priceCurrency as PriceCurrency;
      const photos = teaserCoverPhotos(listing);
      return {
        id: listing.id,
        title: listing.title as Record<string, string>,
        listingType: listing.listingType,
        subCityCode: listing.subCity?.code ?? null,
        subCityName: (listing.subCity?.name as Record<string, string>) ?? null,
        priceAmount: amount,
        priceCurrency: currency,
        imageUrl: photos[0] ?? null,
        priceBand: formatListingPriceBand(
          amount,
          currency,
          preferredCurrency,
          listing.listingType,
          rate,
        ),
      };
    });
    return { teasers, unavailable: false };
  } catch (error) {
    console.error("[home-teasers] falling back to empty:", error);
    return { teasers: [], unavailable: true };
  }
}
