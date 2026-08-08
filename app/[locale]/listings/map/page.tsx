import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import {
  ListingsBrowseMap,
  type MapListingPin,
} from "@/components/maps/ListingsBrowseMap";
import { getSession } from "@/lib/auth/session";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import { fetchPublishedListings } from "@/lib/catalog/queries";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/getDictionary";
import { pickLocalized } from "@/lib/i18n/pickLocalized";
import { resolveListingCoordinates } from "@/lib/maps/addisSubcityCentroids";
import { fetchListingLatLng } from "@/lib/maps/listingGeo";
import { nonClientCatalogRedirect } from "@/lib/roles/catalog-access";
import { buildPageMetadata } from "@/lib/seo/build-metadata";

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
    path: "/listings/map",
    title: translate(dictionary, "pages.listingsMap.title"),
    description: translate(dictionary, "pages.listingsMap.lede"),
  });
}

export default async function ListingsMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const { focus } = await searchParams;
  const toHub = await nonClientCatalogRedirect(locale);
  if (toHub) redirect(toHub);

  const dictionary = getDictionary(locale);
  const t = (key: string) => translate(dictionary, key);
  const base = `/${locale}`;

  const [session, staff, listings] = await Promise.all([
    getSession(),
    getCurrentOpsStaff(),
    fetchPublishedListings(),
  ]);

  const ids = listings.map((l) => l.id);
  const coordsById = await fetchListingLatLng(ids);

  const pins: MapListingPin[] = listings.map((listing) => {
    // Same privacy rule as listing detail: guests only see sub-city centroids.
    const showFull = Boolean(session || staff);
    const stored = coordsById.get(listing.id);
    const resolved = showFull
      ? resolveListingCoordinates({
          lat: stored?.lat,
          lng: stored?.lng,
          subCityCode: listing.subCity?.code,
        })
      : resolveListingCoordinates({
          subCityCode: listing.subCity?.code,
        });

    return {
      id: listing.id,
      title: pickLocalized(listing.title, locale) || listing.id,
      listingType: listing.listingType,
      lat: resolved.lat,
      lng: resolved.lng,
      approx: resolved.approx,
      subCity: listing.subCity
        ? pickLocalized(listing.subCity.name, locale) || listing.subCity.code
        : null,
      href: `${base}/listings/${encodeURIComponent(listing.id)}`,
    };
  });

  return (
    <PageIntro
      eyebrow={dictionary.brand.name}
      title={t("pages.listingsMap.title")}
      lede={t("pages.listingsMap.lede")}
      motto={dictionary.brand.motto}
    >
      <div className="mb-4">
        <Link
          href={`${base}/listings`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          {t("pages.listingsMap.backToList")}
        </Link>
      </div>
      <ListingsBrowseMap
        pins={pins}
        focusId={focus?.trim() || undefined}
        labels={{
          approx: t("pages.listingsMap.approx"),
          empty: t("pages.listingsMap.empty"),
          viewListing: t("pages.listingsMap.viewListing"),
          sale: t("pages.listingsMap.sale"),
          rent: t("pages.listingsMap.rent"),
          offPlan: t("pages.listingsMap.offPlan"),
          missingKey: t("pages.listingsMap.mapKeyMissing"),
          error: t("pages.listingsMap.mapError"),
        }}
      />
    </PageIntro>
  );
}
