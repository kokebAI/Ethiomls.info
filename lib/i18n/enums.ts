import type { Locale } from "@/lib/i18n/config";
import { pickLocalized } from "@/lib/i18n/pickLocalized";

type DictLeaf = Record<string, string> | undefined;

/** Look up an enum label from a dictionary map, with a readable English fallback. */
export function labelEnum(
  map: DictLeaf,
  value: string | null | undefined,
): string {
  if (!value) return "";
  const fromDict = map?.[value];
  if (typeof fromDict === "string" && fromDict.trim()) return fromDict;
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Listing title preferring the active locale, then titleEn / other locales. */
export function localizedListingTitle(
  listing: { titleEn?: string | null; title?: unknown },
  locale: Locale,
  fallback = "Listing",
): string {
  const fromJson = pickLocalized(
    listing.title as Parameters<typeof pickLocalized>[0],
    locale,
  );
  if (fromJson.trim()) return fromJson.trim();
  if (listing.titleEn?.trim()) return listing.titleEn.trim();
  return fallback;
}

/** Sub-city name for the active locale. */
export function localizedSubCityName(
  subCity: { name?: unknown } | null | undefined,
  locale: Locale,
): string {
  if (!subCity?.name) return "";
  return pickLocalized(
    subCity.name as Parameters<typeof pickLocalized>[0],
    locale,
  );
}
