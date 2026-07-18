import {
  CurrencyCode,
  ListingType,
  PropertyCategory,
  type Prisma,
} from "@prisma/client";
import type { SalesKitListingDraft } from "@/lib/imports/sales-kit-parse";

function parseListingType(raw: string): ListingType {
  if (raw === "SALE" || raw === "RENT" || raw === "OFF_PLAN") return raw;
  return ListingType.OFF_PLAN;
}

function parseCategory(raw: string): PropertyCategory {
  if (
    raw === "RESIDENTIAL" ||
    raw === "COMMERCIAL" ||
    raw === "MIXED_USE" ||
    raw === "LAND"
  ) {
    return raw;
  }
  return PropertyCategory.COMMERCIAL;
}

function parseCurrency(raw: string): CurrencyCode {
  return raw === "USD" ? CurrencyCode.USD : CurrencyCode.ETB;
}

/** Map a sales-kit draft onto Prisma listing update fields (no id / owner changes). */
export function listingUpdateFromSalesKitDraft(
  draft: SalesKitListingDraft,
  subCityId: string | null,
): Prisma.ListingUpdateInput {
  const listingType = parseListingType(draft.listingType);
  const priceAmount = draft.price > 0 ? draft.price : 1;

  return {
    title: { en: draft.title, am: draft.title },
    description: { en: draft.description, am: draft.description },
    titleEn: draft.title,
    titleAm: draft.title,
    descriptionEn: draft.description,
    descriptionAm: draft.description,
    listingType,
    category: parseCategory(draft.category),
    priceAmount,
    priceCurrency: parseCurrency(draft.currency),
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    floorAreaSqm: draft.sizeM2 > 0 ? draft.sizeM2 : null,
    addressLine: draft.addressLine || null,
    isUnfinished: listingType === ListingType.OFF_PLAN,
    ...(subCityId
      ? { subCity: { connect: { id: subCityId } } }
      : { subCity: { disconnect: true } }),
  };
}
