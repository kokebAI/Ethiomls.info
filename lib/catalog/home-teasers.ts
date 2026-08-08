import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { teaserCoverPhotos } from "@/lib/catalog/buyer-visibility";
import { formatPriceBand } from "@/lib/catalog/price-band";

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

/** Up to three published teasers for the home gateway — never crash on DB miss. */
export async function fetchHomeTeasers(limit = 3): Promise<HomeTeaser[]> {
  try {
    const listings = await prisma.listing.findMany({
      where: { status: ListingStatus.PUBLISHED },
      include: {
        subCity: { select: { code: true, name: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return listings.map((listing) => {
      const amount = Number(listing.priceAmount);
      const currency = listing.priceCurrency;
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
        priceBand: formatPriceBand(amount, currency, listing.listingType),
      };
    });
  } catch (error) {
    console.error("[home-teasers] falling back to empty:", error);
    return [];
  }
}
