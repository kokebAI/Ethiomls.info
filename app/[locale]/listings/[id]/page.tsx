import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Bath,
  BedDouble,
  Building2,
  Droplets,
  Globe,
  MapPin,
  Phone,
  Ruler,
  Zap,
} from "lucide-react";
import { ListingGallery } from "@/components/property/ListingGallery";
import { VrViewer } from "@/components/property/vr-viewer";
import { getSession } from "@/lib/auth/session";
import { fetchListingById } from "@/lib/catalog/queries";
import { formatMoney } from "@/lib/compliance/currency";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/getDictionary";
import { pickLocalized } from "@/lib/i18n/pickLocalized";

export const dynamic = "force-dynamic";

function prettyEnum(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale: raw, id } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const listing = await fetchListingById(id);
  if (!listing) return { title: "Listing" };
  return {
    title: pickLocalized(listing.title, locale) || listing.id,
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const t = (key: string) => translate(dictionary, key);

  const listing = await fetchListingById(id);
  if (!listing) notFound();

  const base = `/${locale}`;
  const session = await getSession();
  const isSignedIn = Boolean(session);
  const loginHref = `${base}/login?mode=register&next=${encodeURIComponent(`${base}/listings/${listing.id}`)}`;

  const title = pickLocalized(listing.title, locale) || listing.id;
  const description = pickLocalized(listing.description, locale);
  const subCityName = listing.subCity
    ? pickLocalized(listing.subCity.name, locale) || listing.subCity.code
    : null;

  const photos = [
    ...new Set(
      [
        listing.coverImageUrl,
        ...listing.images,
        ...listing.galleryImageUrls,
      ].filter((url): url is string => Boolean(url)),
    ),
  ];

  const panoramas = [
    ...new Set(
      [...listing.panoramicImageUrls, listing.tourUrl].filter(
        (url): url is string => Boolean(url),
      ),
    ),
  ];

  const price = formatMoney(Number(listing.priceAmount), listing.priceCurrency);
  const floorArea =
    listing.floorAreaSqm != null ? Number(listing.floorAreaSqm) : null;
  const plotArea =
    listing.plotAreaSqm != null ? Number(listing.plotAreaSqm) : null;
  const pricePerSqm =
    floorArea && floorArea > 0
      ? formatMoney(
          Math.round(Number(listing.priceAmount) / floorArea),
          listing.priceCurrency,
        )
      : null;

  const typeLabel =
    listing.listingType === "SALE"
      ? t("listing.forSale")
      : listing.listingType === "RENT"
        ? t("listing.forRent")
        : t("listing.offPlan");

  const facts: { label: string; value: string }[] = [
    listing.bedrooms != null
      ? { label: t("listing.bedrooms"), value: String(listing.bedrooms) }
      : null,
    listing.bathrooms != null
      ? { label: t("listing.bathrooms"), value: String(listing.bathrooms) }
      : null,
    floorArea != null
      ? { label: t("listing.floorArea"), value: `${floorArea} m²` }
      : null,
    plotArea != null
      ? { label: t("listing.plotArea"), value: `${plotArea} m²` }
      : null,
    { label: t("listing.propertyType"), value: prettyEnum(listing.category) },
    { label: t("listing.listingType"), value: typeLabel },
    listing.constructionStage
      ? {
          label: t("listing.constructionStage"),
          value: prettyEnum(listing.constructionStage),
        }
      : null,
    listing.completionPercent != null
      ? {
          label: t("listing.completionPercent"),
          value: `${Number(listing.completionPercent)}%`,
        }
      : null,
    pricePerSqm != null
      ? { label: t("listingDetail.pricePerSqm"), value: pricePerSqm }
      : null,
  ].filter((fact): fact is { label: string; value: string } => fact != null);

  const amenities: string[] = [
    listing.waterAvailable ? t("listing.waterAvailability") : null,
    listing.powerBackup ? t("listing.powerBackup") : null,
    ...listing.metadataTags
      .filter(
        (tag) =>
          !tag.startsWith("import") &&
          !tag.startsWith("source:") &&
          !tag.startsWith("telegram:") &&
          !tag.startsWith("phone:"),
      )
      .map((tag) => prettyEnum(tag)),
  ].filter((item): item is string => Boolean(item));

  const developerName =
    listing.developer?.tradeName ||
    (listing.developer?.displayName
      ? pickLocalized(listing.developer.displayName, locale)
      : "") ||
    null;
  const contactName =
    listing.contactName || developerName || listing.owner?.fullName || null;

  const isOffPlan = listing.listingType === "OFF_PLAN";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link
        href={`${base}/listings`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("listingDetail.back")}
      </Link>

      <ListingGallery photos={photos} title={title} />

      {/* Header: badges, title, address, price */}
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
              {typeLabel}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/15">
              {prettyEnum(listing.category)}
            </span>
            {listing.adminAuditApprovedAt ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/15">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t("listingDetail.audited")}
              </span>
            ) : null}
            {listing.openToForeignBuyers ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-600/15">
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                {t("listing.openToForeignBuyers")}
              </span>
            ) : null}
          </div>
          <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-slate-600">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            {[listing.addressLine, subCityName, "Addis Ababa"]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {t("listing.propertyId")}: {listing.id}
          </p>
        </div>

        <div className="shrink-0 space-y-1 lg:text-right">
          <p className="text-3xl font-bold tracking-tight text-slate-900">
            {price}
            {listing.listingType === "RENT" ? (
              <span className="text-base font-semibold text-slate-500">
                {" "}
                {t("listingDetail.perMonth")}
              </span>
            ) : null}
          </p>
          {pricePerSqm ? (
            <p className="text-sm text-slate-500">
              {pricePerSqm} / m²
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {/* Key facts */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {t("listingDetail.facts")}
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              {facts.map((fact) => (
                <div key={fact.label} className="space-y-0.5">
                  <dt className="text-xs font-medium text-slate-500">
                    {fact.label}
                  </dt>
                  <dd className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    {fact.label === t("listing.bedrooms") ? (
                      <BedDouble className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    ) : fact.label === t("listing.bathrooms") ? (
                      <Bath className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    ) : fact.label === t("listing.floorArea") ||
                      fact.label === t("listing.plotArea") ? (
                      <Ruler className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    ) : null}
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Description */}
          {description ? (
            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                {t("listingDetail.description")}
              </h2>
              <p className="mt-3 whitespace-pre-line text-pretty text-sm leading-relaxed text-slate-700">
                {description}
              </p>
            </section>
          ) : null}

          {/* Amenities */}
          {amenities.length > 0 ? (
            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                {t("listingDetail.amenities")}
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {amenities.map((amenity) => (
                  <li
                    key={amenity}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
                  >
                    {amenity === t("listing.waterAvailability") ? (
                      <Droplets className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                    ) : amenity === t("listing.powerBackup") ? (
                      <Zap className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                    ) : null}
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Off-plan payment terms */}
          {isOffPlan ? (
            <section className="rounded-2xl border border-violet-200/80 bg-violet-50/50 p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-violet-700">
                {t("listingDetail.offPlanTerms")}
              </h2>
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-0.5">
                  <dt className="text-xs font-medium text-slate-500">
                    {t("listingDetail.paymentPlan")}
                  </dt>
                  <dd className="text-sm font-semibold text-slate-900">
                    {prettyEnum(listing.paymentStructure)}
                  </dd>
                </div>
                {listing.downPaymentPercent != null ? (
                  <div className="space-y-0.5">
                    <dt className="text-xs font-medium text-slate-500">
                      {t("listingDetail.downPayment")}
                    </dt>
                    <dd className="text-sm font-semibold text-slate-900">
                      {listing.downPaymentPercent}%
                    </dd>
                  </div>
                ) : null}
                {listing.milestoneTranchePercents.length > 0 ? (
                  <div className="space-y-0.5">
                    <dt className="text-xs font-medium text-slate-500">
                      {t("listingDetail.milestones")}
                    </dt>
                    <dd className="text-sm font-semibold text-slate-900">
                      {listing.milestoneTranchePercents.join(" / ")}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          {/* 360° virtual tour — signed-in clients only */}
          {panoramas.length > 0 ? (
            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                {t("listing.virtualTour")}
              </h2>
              {isSignedIn ? (
                <div className="mt-4">
                  <VrViewer panoramicImageUrls={panoramas} />
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm text-slate-600">
                    {t("listingDetail.signUpForTour")}
                  </p>
                  <Link
                    href={loginHref}
                    className="mt-3 inline-flex rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                  >
                    {t("listingDetail.signUpCta")}
                  </Link>
                </div>
              )}
            </section>
          ) : null}
        </div>

        {/* Contact sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-[5.5rem] lg:self-start">
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {t("listingDetail.contact")}
            </h2>
            {isSignedIn ? (
              <>
                {contactName ? (
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {contactName}
                  </p>
                ) : null}
                {developerName && developerName !== contactName ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <Building2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {developerName}
                  </p>
                ) : null}
                {listing.contactPhone ? (
                  <a
                    href={`tel:${listing.contactPhone}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {listing.contactPhone}
                  </a>
                ) : (
                  <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-center text-sm text-slate-600">
                    {t("listingDetail.noPhone")}
                  </p>
                )}
                {listing.sourceUrl ? (
                  <a
                    href={listing.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block text-center text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
                  >
                    {t("listingDetail.sourcePost")}
                  </a>
                ) : null}
              </>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm leading-relaxed text-slate-600">
                  {t("listingDetail.signUpForContact")}
                </p>
                <Link
                  href={loginHref}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  {t("listingDetail.signUpCta")}
                </Link>
                <Link
                  href={`${base}/login?next=${encodeURIComponent(`${base}/listings/${listing.id}`)}`}
                  className="block text-center text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
                >
                  {t("nav.signIn")}
                </Link>
              </div>
            )}
          </section>

          {listing.project ? (
            <Link
              href={`${base}/projects/${listing.project.id}`}
              className="block rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)] transition hover:border-emerald-200"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {t("listingDetail.partOfProject")}
              </p>
              <p className="mt-1.5 text-sm font-semibold text-emerald-700">
                {pickLocalized(listing.project.title, locale) ||
                  listing.project.id}
              </p>
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
