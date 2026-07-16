import type { AddisSubCityCode } from "@/lib/properties/subCities";
import { generatePropertyId } from "@/src/utils/id-generator";

export {
  generateId,
  generatePropertyId,
  isPropertyId,
  PROPERTY_ID_ALPHABET,
  PROPERTY_ID_LENGTH,
} from "@/src/utils/id-generator";

export type ListingTypeAbbr = "SAL" | "RNT" | "OFP";

const SUB_CITY_ABBR: Record<AddisSubCityCode, string> = {
  "addis-ketema": "ADK",
  "akaky-kaliti": "AKA",
  arada: "ARD",
  bole: "BOL",
  gullele: "GUL",
  kirkos: "KIR",
  "kolfe-keranio": "KOL",
  lideta: "LID",
  "nifas-silk-lafto": "NSL",
  yeka: "YEK",
  "lemi-kura": "LMK",
};

const TYPE_ABBR: Record<string, ListingTypeAbbr> = {
  SALE: "SAL",
  RENT: "RNT",
  OFF_PLAN: "OFP",
};

/**
 * Compact sub-city abbreviation for MLS-style IDs (e.g. bole → BOL).
 */
export function subCityAbbr(code: string): string {
  return (
    SUB_CITY_ABBR[code as AddisSubCityCode] ??
    code.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X")
  );
}

/**
 * Developer short code from registrationNumber (`ET-DIR-NOAH-001` → `NOAH`)
 * or a trade-name slug fallback.
 */
export function developerAbbr(
  registrationNumber: string,
  tradeNameFallback?: string,
): string {
  const fromReg = registrationNumber.match(/ET-DIR-([A-Z0-9]+)-\d+/i);
  if (fromReg?.[1]) return fromReg[1].toUpperCase().slice(0, 6);

  const fromLegacy = registrationNumber.match(/ET-RE-\d+-(\d+)/i);
  if (fromLegacy?.[1]) return `D${fromLegacy[1]}`.slice(0, 6);

  const slug = (tradeNameFallback ?? "DEV")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()
    .slice(0, 6);
  return slug || "DEV";
}

export function listingTypeAbbr(listingType: string): ListingTypeAbbr {
  return TYPE_ABBR[listingType] ?? "SAL";
}

function padFloor(floor: number): string {
  const n = Math.max(0, Math.floor(floor));
  return String(n).padStart(2, "0");
}

function normalizeUnitLabel(unitLabel: string): string {
  return unitLabel.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4) || "U";
}

/**
 * Stable source key for scrape/seed upserts (not the public listing id).
 * Public IDs are random 6-char codes from `generatePropertyId()`.
 */
export function buildListingSourceKey(input: {
  projectId?: string;
  subCityCode?: string;
  floor: number;
  unitLabel: string;
}): string {
  const scope =
    input.projectId ??
    (input.subCityCode ? `SUB-${subCityAbbr(input.subCityCode)}` : "GEN");
  return `source:${scope}:F${padFloor(input.floor)}:${normalizeUnitLabel(input.unitLabel)}`;
}

/** @deprecated Use `generatePropertyId()` — alias retained for older call sites. */
export function buildPropertyId(_input?: unknown): string {
  void _input;
  return generatePropertyId();
}

/**
 * Project / building stack ID.
 * Pattern: `ETMLS-PRJ-{SUB}-{DEV}-{SLUG}`
 * Example: `ETMLS-PRJ-BOL-NOAH-SKYTOWER-2025`
 */
export function buildProjectId(input: {
  subCityCode: string;
  developerRegistration: string;
  developerTradeName?: string;
  slug: string;
}): string {
  const sub = subCityAbbr(input.subCityCode);
  const dev = developerAbbr(
    input.developerRegistration,
    input.developerTradeName,
  );
  const slug = input.slug
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()
    .slice(0, 24);
  return `ETMLS-PRJ-${sub}-${dev}-${slug}`;
}

export function parseFloorFromTags(tags: string[]): number | null {
  for (const tag of tags) {
    const match = /^floor:(-?\d+)$/i.exec(tag.trim());
    if (match) return Number(match[1]);
  }
  return null;
}

export function parseUnitLabelFromTags(tags: string[]): string | null {
  for (const tag of tags) {
    const match = /^unit:(.+)$/i.exec(tag.trim());
    if (match) return match[1].trim();
  }
  return null;
}
