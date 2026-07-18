import type { Locale } from "@/lib/i18n/config";
import { absoluteUrl, getSiteUrl } from "@/lib/seo/config";

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(): JsonLd {
  const site = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${site}/#organization`,
    name: "EthioMLS",
    url: site,
    description:
      "Verified property listings for buying and renting in Addis Ababa — built for Ethiopian diaspora and global investors.",
    areaServed: {
      "@type": "City",
      name: "Addis Ababa",
      containedInPlace: {
        "@type": "Country",
        name: "Ethiopia",
      },
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Addis Ababa",
      addressCountry: "ET",
    },
    knowsAbout: [
      "Addis Ababa real estate",
      "diaspora property investment",
      "off-plan housing Ethiopia",
      "foreign buyer clearance Ethiopia",
    ],
    availableLanguage: ["en", "am", "om", "ti"],
  };
}

export function websiteJsonLd(locale: Locale): JsonLd {
  const site = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site}/#website`,
    name: "EthioMLS",
    url: absoluteUrl(`/${locale}`),
    inLanguage: locale,
    publisher: { "@id": `${site}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl(`/${locale}/listings?q={search_term_string}`),
      },
      "query-input": "required name=search_term_string",
    },
    about: {
      "@type": "Thing",
      name: "Buy and rent property in Addis Ababa",
    },
    audience: {
      "@type": "Audience",
      audienceType:
        "Ethiopian diaspora, international investors, local buyers and renters",
    },
  };
}

export function realEstateListingJsonLd(input: {
  locale: Locale;
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrls: string[];
  price: number;
  currency: string;
  listingType: "SALE" | "RENT" | "OFF_PLAN" | string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floorAreaSqm?: number | null;
  addressLine?: string | null;
  subCity?: string | null;
}): JsonLd {
  const availability =
    input.listingType === "RENT"
      ? "https://schema.org/ForRent"
      : "https://schema.org/ForSale";

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": input.url,
    name: input.title,
    description:
      input.description ||
      `${input.title} — verified Addis Ababa listing on EthioMLS for diaspora and investors.`,
    url: input.url,
    inLanguage: input.locale,
    datePosted: new Date().toISOString(),
    image: input.imageUrls.slice(0, 8),
    offers: {
      "@type": "Offer",
      price: input.price,
      priceCurrency: input.currency,
      availability,
      businessFunction:
        input.listingType === "RENT"
          ? "https://schema.org/LeaseOut"
          : "https://schema.org/Sell",
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: input.addressLine || undefined,
      addressLocality: input.subCity || "Addis Ababa",
      addressRegion: "Addis Ababa",
      addressCountry: "ET",
    },
    ...(input.bedrooms != null ||
    input.bathrooms != null ||
    input.floorAreaSqm != null
      ? {
          mainEntity: {
            "@type": "Apartment",
            numberOfRooms: input.bedrooms ?? undefined,
            numberOfBathroomsTotal: input.bathrooms ?? undefined,
            floorSize:
              input.floorAreaSqm != null
                ? {
                    "@type": "QuantitativeValue",
                    value: input.floorAreaSqm,
                    unitCode: "MTK",
                  }
                : undefined,
          },
        }
      : {}),
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
