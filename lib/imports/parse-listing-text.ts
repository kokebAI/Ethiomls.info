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

/**
 * Corridor neighborhoods / landmarks / project brands → canonical sub-city.
 * Longer aliases first so multi-word names win.
 */
const CORRIDOR_NEIGHBORHOOD_ALIASES: Array<{
  alias: string;
  subCity: AddisSubCityCode;
  label: string;
  areaTag: string;
  corridor: "central" | "east" | "west" | "south";
}> = [
  // East
  { alias: "ayat feres bet", subCity: "yeka", label: "Ayat Feres Bet", areaTag: "ayat-feres-bet", corridor: "east" },
  { alias: "feres bet", subCity: "yeka", label: "Feres Bet", areaTag: "feres-bet", corridor: "east" },
  { alias: "ayat achante", subCity: "yeka", label: "Ayat Achanté", areaTag: "ayat-achante", corridor: "east" },
  { alias: "ayat achanté", subCity: "yeka", label: "Ayat Achanté", areaTag: "ayat-achante", corridor: "east" },
  { alias: "achante", subCity: "yeka", label: "Achanté", areaTag: "achante", corridor: "east" },
  { alias: "achanté", subCity: "yeka", label: "Achanté", areaTag: "achante", corridor: "east" },
  { alias: "ayat hills", subCity: "yeka", label: "Ayat Hills", areaTag: "ayat", corridor: "east" },
  { alias: "megenagna", subCity: "yeka", label: "Megenagna", areaTag: "megenagna", corridor: "east" },
  { alias: "gerji", subCity: "bole", label: "Gerji", areaTag: "gerji", corridor: "east" },
  { alias: "ayat", subCity: "yeka", label: "Ayat", areaTag: "ayat", corridor: "east" },
  { alias: "temer", subCity: "yeka", label: "Temer", areaTag: "temer", corridor: "east" },
  { alias: "cmc", subCity: "yeka", label: "CMC", areaTag: "cmc", corridor: "east" },
  { alias: "summit", subCity: "lemi-kura", label: "Summit", areaTag: "summit", corridor: "east" },
  { alias: "lemi kura", subCity: "lemi-kura", label: "Lemi Kura", areaTag: "lemi-kura", corridor: "east" },
  { alias: "bole airport", subCity: "bole", label: "Bole Airport", areaTag: "bole", corridor: "east" },
  { alias: "atlas", subCity: "bole", label: "Atlas", areaTag: "atlas", corridor: "east" },
  // Central
  { alias: "kazanchis", subCity: "kirkos", label: "Kazanchis", areaTag: "kazanchis", corridor: "central" },
  { alias: "meskel square", subCity: "kirkos", label: "Meskel Square", areaTag: "meskel", corridor: "central" },
  { alias: "mexico", subCity: "kirkos", label: "Mexico", areaTag: "mexico", corridor: "central" },
  { alias: "piassa", subCity: "arada", label: "Piassa", areaTag: "piassa", corridor: "central" },
  { alias: "piazza", subCity: "arada", label: "Piazza", areaTag: "piassa", corridor: "central" },
  { alias: "4 kilo", subCity: "arada", label: "4 Kilo", areaTag: "4-kilo", corridor: "central" },
  { alias: "6 kilo", subCity: "gullele", label: "6 Kilo", areaTag: "6-kilo", corridor: "central" },
  { alias: "sidist kilo", subCity: "gullele", label: "Sidist Kilo", areaTag: "sidist-kilo", corridor: "central" },
  { alias: "merkato", subCity: "addis-ketema", label: "Merkato", areaTag: "merkato", corridor: "central" },
  // West
  { alias: "tor hailoch", subCity: "kolfe-keranio", label: "Tor Hailoch", areaTag: "tor-hailoch", corridor: "west" },
  { alias: "asko", subCity: "kolfe-keranio", label: "Asko", areaTag: "asko", corridor: "west" },
  { alias: "shiromeda", subCity: "gullele", label: "Shiromeda", areaTag: "shiromeda", corridor: "west" },
  { alias: "shiro meda", subCity: "gullele", label: "Shiro Meda", areaTag: "shiromeda", corridor: "west" },
  { alias: "entoto", subCity: "gullele", label: "Entoto", areaTag: "entoto", corridor: "west" },
  // South
  { alias: "jemo", subCity: "nifas-silk-lafto", label: "Jemo", areaTag: "jemo", corridor: "south" },
  { alias: "gelan", subCity: "akaky-kaliti", label: "Gelan", areaTag: "gelan", corridor: "south" },
  { alias: "kaliti", subCity: "akaky-kaliti", label: "Kaliti", areaTag: "kaliti", corridor: "south" },
  { alias: "akaky", subCity: "akaky-kaliti", label: "Akaky Kaliti", areaTag: "akaky-kaliti", corridor: "south" },
  { alias: "lafto", subCity: "nifas-silk-lafto", label: "Lafto", areaTag: "lafto", corridor: "south" },
];

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
  /** Neighborhood slug for metadataTags, e.g. ayat */
  areaTag: string | null;
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

function detectCorridorNeighborhood(text: string): {
  subCity: AddisSubCityCode;
  label: string;
  areaTag: string;
  corridor: "central" | "east" | "west" | "south";
} | null {
  const lower = text.toLowerCase();
  for (const entry of CORRIDOR_NEIGHBORHOOD_ALIASES) {
    if (lower.includes(entry.alias)) {
      return {
        subCity: entry.subCity,
        label: entry.label,
        areaTag: entry.areaTag,
        corridor: entry.corridor,
      };
    }
  }
  return null;
}

/** @deprecated Prefer detectCorridorNeighborhood */
function detectEastNeighborhood(text: string) {
  return detectCorridorNeighborhood(text);
}

function detectSubCity(text: string): AddisSubCityCode | null {
  const corridor = detectCorridorNeighborhood(text);
  if (corridor) return corridor.subCity;

  const lower = text.toLowerCase();
  for (const [alias, code] of Object.entries(SUB_CITY_ALIASES)) {
    if (lower.includes(alias)) return code;
  }
  for (const code of ADDIS_SUB_CITY_CODES) {
    if (lower.includes(code.replace(/-/g, " "))) return code;
  }
  return null;
}

function formatSubCityLabel(code: AddisSubCityCode): string {
  return code
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function detectListingType(text: string): ListingType {
  const lower = text.toLowerCase();
  if (
    /off[\s-]?plan|ቀድሞ|ቅድመ|under construction|installment|አዲስ ፕሮጀክት/.test(lower)
  ) {
    return ListingType.OFF_PLAN;
  }
  if (/for\s*rent|to\s*rent|ለኪራይ|ኪራይ|አከራይ|rent\b|monthly/.test(lower)) {
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
    /(?:USD|\$)\s*([0-9]{1,3}(?:[, ]?[0-9]{3})*(?:\.[0-9]+)?)|([0-9]{1,3}(?:[, ]?[0-9]{3})*(?:\.[0-9]+)?)\s*(?:USD|\$)/i,
  );
  if (usd) {
    const amount = Number((usd[1] ?? usd[2] ?? "").replace(/[, ]/g, ""));
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
  const corridorHit = detectCorridorNeighborhood(text);
  const subCityCode = corridorHit?.subCity ?? detectSubCity(text);
  const listingType = detectListingType(text);
  const category = detectCategory(text);
  const areaTag = corridorHit?.areaTag ?? null;

  const addressLine = corridorHit
    ? corridorHit.label
    : subCityCode
      ? formatSubCityLabel(subCityCode)
      : null;

  const firstLine =
    text
      .split(/[\n.!?]/)
      .map((part) => part.trim())
      .find((part) => part.length >= 12) ?? text.slice(0, 80);

  const title =
    firstLine.slice(0, 120) ||
    `${listingType === ListingType.RENT ? "Rental" : "Property"} in ${
      addressLine ?? subCityCode ?? "Addis Ababa"
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
    addressLine,
    areaTag,
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

/** Exported for corridor off-plan filters. */
export {
  CORRIDOR_NEIGHBORHOOD_ALIASES,
  detectCorridorNeighborhood,
  detectEastNeighborhood,
};
