import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveListingCoverUrl } from "@/lib/catalog/listing-cover";
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

/** Up to three published teasers for the home gateway — never crash on DB miss. */
export async function fetchHomeTeasers(limit = 3): Promise<HomeTeaser[]> {
  try {
    const { currency: preferredCurrency, rateUsdEtb } =
      await readDisplayCurrencyPreference();
    const rate = resolveNbeUsdEtbRate(rateUsdEtb);
    // Prefer listings that already have a non-placeholder cover so the home
    // grid is not a wall of identical stock photos / empty planes.
    const listings = await prisma.listing.findMany({
      where: {
        status: ListingStatus.PUBLISHED,
        OR: [
          { coverImageUrl: { not: null } },
          { images: { isEmpty: false } },
        ],
      },
      include: {
        subCity: { select: { code: true, name: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: Math.max(limit * 4, 16),
    });

    const ranked = [...listings].sort((a, b) => {
      const aWeak =
        !a.coverImageUrl ||
        a.coverImageUrl.includes("photo-1560518883-ce09059eeffa")
          ? 1
          : 0;
      const bWeak =
        !b.coverImageUrl ||
        b.coverImageUrl.includes("photo-1560518883-ce09059eeffa")
          ? 1
          : 0;
      return aWeak - bWeak;
    });

    return ranked.slice(0, limit).map((listing) => {
      const amount = Number(listing.priceAmount);
      const currency = listing.priceCurrency as PriceCurrency;
      return {
        id: listing.id,
        title: listing.title as Record<string, string>,
        listingType: listing.listingType,
        subCityCode: listing.subCity?.code ?? null,
        subCityName: (listing.subCity?.name as Record<string, string>) ?? null,
        priceAmount: amount,
        priceCurrency: currency,
        imageUrl: resolveListingCoverUrl(listing),
        priceBand: formatListingPriceBand(
          amount,
          currency,
          preferredCurrency,
          listing.listingType,
          rate,
        ),
      };
    });
  } catch (error) {
    console.error("[home-teasers] falling back to empty:", error);
    return [];
  }
}
