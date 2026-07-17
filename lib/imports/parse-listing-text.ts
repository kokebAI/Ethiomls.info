import { ADDIS_SUB_CITY_CODES, type AddisSubCityCode } from "@/lib/properties/subCities";
import { ListingType, PropertyCategory, CurrencyCode } from "@prisma/client";

const SUB_CITY_ALIASES: Record<string, AddisSubCityCode> = {
  bole: "bole",
  yeka: "yeka",
  kirkos: "kirkos",
  "nifas silk": "nifas-silk-lafto",
  "nifas-silk": "nifas-silk-lafto",
  lafto: "nifas-silk-lafto",
  lideta: "lideta",
  arada: "arada",
  gullele: "gullele",
  "addis ketema": "addis-ketema",
  "akaky kaliti": "akaky-kaliti",
  "kolfe keranio": "kolfe-keranio",
  kolfe: "kolfe-keranio",
  "lemi kura": "lemi-kura",
  lemikura: "lemi-kura",
};

export type ParsedListingDraft = {
  title: string;
  description: string;
  listingType: ListingType;
  category: PropertyCategory;
  priceAmount: number;
  priceCurrency: CurrencyCode;
  bedrooms: number | null;
  bathrooms: number | null;
  floorAreaSqm: number | null;
  subCityCode: AddisSubCityCode | null;
  addressLine: string | null;
};

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSubCity(text: string): AddisSubCityCode | null {
  const lower = text.toLowerCase();
  for (const [alias, code] of Object.entries(SUB_CITY_ALIASES)) {
    if (lower.includes(alias)) return code;
  }
  for (const code of ADDIS_SUB_CITY_CODES) {
    if (lower.includes(code.replace(/-/g, " "))) return code;
  }
  return null;
}

function detectListingType(text: string): ListingType {
  const lower = text.toLowerCase();
  if (
    /off[\s-]?plan|ቀድሞ|under construction|installment|አዲስ ፕሮጀክት/.test(lower)
  ) {
    return ListingType.OFF_PLAN;
  }
  if (/for\s*rent|to\s*rent|ለኪራይ|rent\b|monthly/.test(lower)) {
    return ListingType.RENT;
  }
  return ListingType.SALE;
}

function detectCategory(text: string): PropertyCategory {
  const lower = text.toLowerCase();
  if (/commercial|office|shop|warehouse|የንግድ/.test(lower)) {
    return PropertyCategory.COMMERCIAL;
  }
  if (/land|ቦታ|plot/.test(lower)) return PropertyCategory.LAND;
  if (/mixed/.test(lower)) return PropertyCategory.MIXED_USE;
  return PropertyCategory.RESIDENTIAL;
}

function extractPrice(text: string): {
  amount: number;
  currency: CurrencyCode;
} | null {
  const usd = text.match(
    /(?:USD|\$)\s*([0-9]{1,3}(?:[, ]?[0-9]{3})*(?:\.[0-9]+)?)/i,
  );
  if (usd) {
    const amount = Number(usd[1].replace(/[, ]/g, ""));
    if (Number.isFinite(amount) && amount > 0) {
      return { amount, currency: CurrencyCode.USD };
    }
  }

  const etb = text.match(
    /(?:ETB|ብር|br\.?|price[:\s-]*)\s*([0-9]{1,3}(?:[, ]?[0-9]{3})+(?:\.[0-9]+)?|\d+(?:\.\d+)?)\s*(?:million|ሺ|ም|mln)?/i,
  );
  if (etb) {
    let amount = Number(etb[1].replace(/[, ]/g, ""));
    if (/million|mln|ም/i.test(etb[0])) amount *= 1_000_000;
    if (Number.isFinite(amount) && amount > 0) {
      return { amount, currency: CurrencyCode.ETB };
    }
  }

  const bare = text.match(
    /\b([0-9]{1,3}(?:,[0-9]{3}){2,}(?:\.[0-9]+)?)\b/,
  );
  if (bare) {
    const amount = Number(bare[1].replace(/,/g, ""));
    if (Number.isFinite(amount) && amount >= 100_000) {
      return { amount, currency: CurrencyCode.ETB };
    }
  }

  return null;
}

function extractBedrooms(text: string): number | null {
  const match = text.match(/(\d+)\s*(?:bed(?:room)?s?|ብርድሮም|ክፍል)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractBathrooms(text: string): number | null {
  const match = text.match(/(\d+)\s*(?:bath(?:room)?s?|ባትሮም)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractArea(text: string): number | null {
  const match = text.match(
    /(\d{2,5}(?:\.\d+)?)\s*(?:m2|m²|sqm|sq\.?\s*m|ካሬ)/i,
  );
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function parseListingText(rawHtmlOrText: string): ParsedListingDraft {
  const text = decodeEntities(rawHtmlOrText);
  const price = extractPrice(text);
  const bedrooms = extractBedrooms(text);
  const bathrooms = extractBathrooms(text);
  const floorAreaSqm = extractArea(text);
  const subCityCode = detectSubCity(text);
  const listingType = detectListingType(text);
  const category = detectCategory(text);

  const firstLine =
    text
      .split(/[\n.!?]/)
      .map((part) => part.trim())
      .find((part) => part.length >= 12) ?? text.slice(0, 80);

  const title =
    firstLine.slice(0, 120) ||
    `${listingType === ListingType.RENT ? "Rental" : "Property"} in ${
      subCityCode ?? "Addis Ababa"
    }`;

  return {
    title,
    description: text.slice(0, 4000) || title,
    listingType,
    category,
    priceAmount: price?.amount ?? 0,
    priceCurrency: price?.currency ?? CurrencyCode.ETB,
    bedrooms,
    bathrooms,
    floorAreaSqm,
    subCityCode,
    addressLine: subCityCode
      ? subCityCode
          .split("-")
          .map((part) => part[0]?.toUpperCase() + part.slice(1))
          .join(" ")
      : null,
  };
}

/** True when the snippet looks like a property advert rather than a channel promo. */
export function looksLikeListing(text: string): boolean {
  const lower = text.toLowerCase();
  if (text.trim().length < 40) return false;
  const hasHousingCue =
    /house|apartment|flat|villa|condo|ቤት|አፓርትመንት|for sale|for rent|off.?plan|bedroom|m2|m²|price|ብር|etb|usd/.test(
      lower,
    );
  const hasContactOrPrice =
    extractPrice(text) !== null ||
    /(?:\+?251|0)?[79]\d{8}/.test(text.replace(/\s+/g, ""));
  return hasHousingCue && hasContactOrPrice;
}
