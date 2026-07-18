import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/config";
import {
  absoluteUrl,
  DIASPORA_SEARCH_KEYWORDS,
  getSiteUrl,
  hreflangAlternates,
  OG_LOCALE_MAP,
} from "@/lib/seo/config";

export type PageSeoInput = {
  locale: Locale;
  /** Path after locale, e.g. `/listings` or `/` */
  path: string;
  title: string;
  description: string;
  /** Absolute or site-relative image URL */
  image?: string | null;
  keywords?: string[];
  type?: "website" | "article";
  noIndex?: boolean;
};

export function buildPageMetadata(input: PageSeoInput): Metadata {
  const path = input.path === "/" ? "" : input.path;
  const canonical = absoluteUrl(`/${input.locale}${path}`);
  const imageUrl = input.image
    ? input.image.startsWith("http")
      ? input.image
      : absoluteUrl(input.image)
    : null;

  const keywords = [
    ...DIASPORA_SEARCH_KEYWORDS,
    ...(input.keywords ?? []),
  ];

  return {
    title: input.title,
    description: input.description,
    keywords: [...new Set(keywords)],
    authors: [{ name: "EthioMLS" }],
    creator: "EthioMLS",
    publisher: "EthioMLS",
    category: "Real Estate",
    applicationName: "EthioMLS",
    metadataBase: new URL(getSiteUrl()),
    alternates: {
      canonical,
      languages: hreflangAlternates(input.path).languages,
    },
    openGraph: {
      type: input.type ?? "website",
      locale: OG_LOCALE_MAP[input.locale],
      alternateLocale: Object.values(OG_LOCALE_MAP).filter(
        (tag) => tag !== OG_LOCALE_MAP[input.locale],
      ),
      url: canonical,
      siteName: "EthioMLS — Addis Ababa Real Estate",
      title: input.title,
      description: input.description,
      ...(imageUrl
        ? {
            images: [
              {
                url: imageUrl,
                width: 1200,
                height: 630,
                alt: input.title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
    robots: input.noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    other: {
      "geo.region": "ET-AA",
      "geo.placename": "Addis Ababa",
      "geo.position": "9.03;38.74",
      ICBM: "9.03, 38.74",
      "og:locale:alternate": Object.values(OG_LOCALE_MAP)
        .filter((tag) => tag !== OG_LOCALE_MAP[input.locale])
        .join(","),
    },
  };
}

/** Default sitewide SEO for the locale layout shell. */
export function buildRootLocaleMetadata(locale: Locale, brand: {
  name: string;
  tagline: string;
}): Metadata {
  const title =
    locale === "en"
      ? "EthioMLS — Buy & Rent Property in Addis Ababa | Diaspora Investors"
      : brand.name;
  const description =
    locale === "en"
      ? "Verified homes, off-plan projects, and commercial spaces across Addis Ababa. Built for Ethiopian diaspora investors worldwide — buy, rent, and invest with escrow-backed listings."
      : brand.tagline;

  const page = buildPageMetadata({
    locale,
    path: "/",
    title,
    description,
    keywords: [
      "Addis Ababa buy apartment",
      "Addis Ababa rent house",
      "diaspora Ethiopia investment",
    ],
  });

  return {
    ...page,
    title: {
      default: title,
      template: `%s · ${brand.name}`,
    },
  };
}
