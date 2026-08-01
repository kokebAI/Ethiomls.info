import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { ListingsFunnel } from "./listings-funnel";
import { getSession } from "@/lib/auth/session";
import {
  allListingPhotos,
  canViewFullListingDetails,
  teaserCoverPhotos,
} from "@/lib/catalog/buyer-visibility";
import {
  formatPriceBand,
  priceBandSortKey,
} from "@/lib/catalog/price-band";
import { fetchPublishedListings } from "@/lib/catalog/queries";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/getDictionary";
import { pickLocalized } from "@/lib/i18n/pickLocalized";
import { formatMoney } from "@/lib/compliance/currency";
import { countNoun } from "@/lib/i18n/plural";
import type { DirectoryBadge } from "@/components/PageDirectory";
import { nonClientCatalogRedirect } from "@/lib/roles/catalog-access";
import { buildPageMetadata } from "@/lib/seo/build-metadata";

function listingBadge(type: string, t: (key: string) => string): DirectoryBadge {
  switch (type) {
    case "SALE":
      return { label: t("listing.forSale"), tone: "emerald" };
    case "RENT":
      return { label: t("listing.forRent"), tone: "sky" };
    case "OFF_PLAN":
      return { label: t("listing.offPlan"), tone: "violet" };
    default:
      return { label: type.replaceAll("_", " "), tone: "slate" };
  }
}

/** DB-backed page — skip SSG so Vercel builds succeed without live Postgres. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);

  return buildPageMetadata({
    locale,
    path: "/listings",
    title:
      locale === "en"
        ? "Addis Ababa Property for Sale & Rent | Verified Listings"
        : translate(dictionary, "pages.listings.title"),
    description:
      locale === "en"
        ? "Browse verified homes and commercial spaces for sale or rent across Addis Ababa sub-cities. Built for diaspora buyers and international investors."
        : translate(dictionary, "pages.listings.lede"),
    keywords: [
      "Addis Ababa property for sale",
      "Addis Ababa apartments for rent",
      "Bole Kirkos Yeka listings",
      "diaspora buy home Ethiopia",
    ],
  });
}

export default async function ListingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const toHub = await nonClientCatalogRedirect(locale);
  if (toHub) redirect(toHub);

  const dictionary = getDictionary(locale);
  const [listings, session] = await Promise.all([
    fetchPublishedListings(),
    getSession(),
  ]);
  const showFull = canViewFullListingDetails({ session });

  const t = (key: string) => translate(dictionary, key);

  const items = listings.map((listing) => {
    const subCity = listing.subCity
      ? pickLocalized(listing.subCity.name, locale) || listing.subCity.code
      : "—";
    const subCityCode = listing.subCity?.code ?? "";
    const amount = Number(listing.priceAmount);
    const currency = listing.priceCurrency;
    const priceFormatted = showFull
      ? formatMoney(amount, currency)
      : formatPriceBand(amount, currency, listing.listingType);

    const photos = showFull
      ? allListingPhotos(listing)
      : teaserCoverPhotos(listing);

    return {
      id: listing.id,
      title: pickLocalized(listing.title, locale) || listing.id,
      href: `/${locale}/listings/${listing.id}`,
      imageUrl: photos[0] ?? null,
      photoCount: showFull ? photos.length : photos.length > 0 ? 1 : 0,
      meta: [
        subCity,
        priceFormatted,
        listing.bedrooms != null
          ? countNoun(
              listing.bedrooms,
              t("listing.bedroomUnit"),
              t("listing.bedroomsUnit"),
            )
          : null,
        listing.bathrooms != null
          ? countNoun(
              listing.bathrooms,
              t("listing.bathroomUnit"),
              t("listing.bathroomsUnit"),
            )
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      badges: [
        listingBadge(listing.listingType, t),
        {
          label:
            listing.listingScope === "PROPERTY"
              ? t("listing.scopeProperty")
              : t("listing.scopeSingle"),
          tone: listing.listingScope === "PROPERTY" ? "amber" : "slate",
        } as DirectoryBadge,
      ],
      subCityCode,
      listingType: listing.listingType,
      // Guests get band midpoints only — never exact list prices in HTML props.
      priceAmount: showFull
        ? amount
        : priceBandSortKey(amount, currency, listing.listingType),
      priceCurrency: currency,
      completionPercent:
        listing.completionPercent != null
          ? Number(listing.completionPercent)
          : null,
    };
  });

  const subCityMap = new Map<string, string>();
  for (const listing of listings) {
    if (listing.subCity) {
      subCityMap.set(
        listing.subCity.code,
        pickLocalized(listing.subCity.name, locale) || listing.subCity.code,
      );
    }
  }

  const subCities = [...subCityMap.entries()]
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  return (
    <PageIntro
      eyebrow={dictionary.brand.name}
      title={dictionary.pages.listings.title}
      lede={dictionary.pages.listings.lede}
      motto={dictionary.brand.motto}
    >
      {items.length > 0 ? (
        <p
          className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 ring-1 ring-emerald-600/15 ring-inset"
          role="status"
        >
          {translate(dictionary, "pages.recordCount", { count: items.length })}
        </p>
      ) : null}
      <ListingsFunnel
        listings={items}
        subCities={subCities}
        emptyMessage={translate(dictionary, "pages.emptyDirectory")}
        imagePlaceholder={t("listing.photoComingSoon")}
      />
    </PageIntro>
  );
}
