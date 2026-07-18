import type { Locale } from "@/lib/i18n/config";
import { locales } from "@/lib/i18n/config";

/** Canonical public origin for absolute URLs in sitemap / Open Graph. */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    "https://ethiomls.info";
  const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Open Graph locale tags for each EthioMLS UI language. */
export const OG_LOCALE_MAP: Record<Locale, string> = {
  en: "en_US",
  am: "am_ET",
  om: "om_ET",
  ti: "ti_ET",
};

/**
 * High-intent search phrases for Ethiopian diaspora & global investors
 * looking to buy or rent in Addis Ababa.
 */
export const DIASPORA_SEARCH_KEYWORDS = [
  "Addis Ababa real estate",
  "buy property Addis Ababa",
  "rent apartment Addis Ababa",
  "Addis Ababa homes for sale",
  "Addis Ababa apartments for rent",
  "Ethiopia property investment",
  "Ethiopian diaspora real estate",
  "diaspora invest Ethiopia",
  "off plan Addis Ababa",
  "Bole apartment for sale",
  "verified listings Ethiopia",
  "EthioMLS",
  "foreign buyer Ethiopia property",
  "escrow property Addis Ababa",
  "commercial space Addis Ababa",
  "Addis Ababa MLS",
] as const;

/** Build hreflang map for a path after the locale segment (e.g. `/listings`). */
export function hreflangAlternates(pathAfterLocale: string): {
  languages: Record<string, string>;
} {
  const suffix =
    !pathAfterLocale || pathAfterLocale === "/"
      ? ""
      : pathAfterLocale.startsWith("/")
        ? pathAfterLocale
        : `/${pathAfterLocale}`;

  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = absoluteUrl(`/${locale}${suffix}`);
  }
  languages["x-default"] = absoluteUrl(`/en${suffix}`);
  return { languages };
}
