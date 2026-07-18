import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PageDirectory, type DirectoryBadge } from "@/components/PageDirectory";
import { PageIntro } from "@/components/PageIntro";
import { formatMoney } from "@/lib/compliance/currency";
import {
  fetchDeveloperById,
  fetchPublishedListingsByDeveloper,
  fetchPublishedProjectsByDeveloper,
} from "@/lib/catalog/queries";
import { formatConstructionStage } from "@/lib/domain/construction-stage";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/getDictionary";
import { countNoun } from "@/lib/i18n/plural";
import { pickLocalized } from "@/lib/i18n/pickLocalized";

export const dynamic = "force-dynamic";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale: raw, id } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const developer = await fetchDeveloperById(id);
  if (!developer) return { title: "Developer" };
  return {
    title:
      pickLocalized(developer.displayName, locale) || developer.tradeName,
  };
}

export default async function DeveloperDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(dictionary, key, vars);

  const developer = await fetchDeveloperById(id);
  if (!developer) notFound();

  const [listings, projects] = await Promise.all([
    fetchPublishedListingsByDeveloper(developer.id),
    fetchPublishedProjectsByDeveloper(developer.id),
  ]);

  const name =
    pickLocalized(developer.displayName, locale) || developer.tradeName;
  const hq = developer.headquartersSubCity
    ? pickLocalized(developer.headquartersSubCity.name, locale) ||
      developer.headquartersSubCity.code
    : null;
  const base = `/${locale}`;

  const listingItems = listings.map((listing) => {
    const subCity = listing.subCity
      ? pickLocalized(listing.subCity.name, locale) || listing.subCity.code
      : "—";
    const photos = [
      ...new Set(
        [
          listing.coverImageUrl,
          ...listing.images,
          ...listing.galleryImageUrls,
        ].filter((url): url is string => Boolean(url)),
      ),
    ];

    return {
      id: listing.id,
      title: pickLocalized(listing.title, locale) || listing.id,
      href: `${base}/listings/${listing.id}`,
      imageUrl: photos[0] ?? null,
      photoCount: photos.length,
      meta: [
        subCity,
        formatMoney(Number(listing.priceAmount), listing.priceCurrency),
        listing.bedrooms != null
          ? countNoun(
              listing.bedrooms,
              t("listing.bedroomUnit"),
              t("listing.bedroomsUnit"),
            )
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      badges: [listingBadge(listing.listingType, t)],
    };
  });

  const projectItems = projects.map((project) => {
    const subCity = project.subCity
      ? pickLocalized(project.subCity.name, locale) || project.subCity.code
      : "—";
    const stageLabel = formatConstructionStage(project.constructionStage);
    const completion = `${Number(project.completionPercent)}%`;

    return {
      id: project.id,
      title: pickLocalized(project.title, locale) || project.id,
      href: `${base}/projects/${encodeURIComponent(project.id)}`,
      meta: [subCity, stageLabel, completion].join(" · "),
      badges: [
        { label: stageLabel, tone: "violet" as const },
        { label: completion, tone: "emerald" as const },
      ],
    };
  });

  return (
    <PageIntro
      eyebrow={dictionary.brand.name}
      title={name}
      lede={
        hq
          ? t("pages.developers.detailLede", { area: hq })
          : t("pages.developers.detailLedeFallback")
      }
      motto={dictionary.brand.motto}
    >
      <Link
        href={`${base}/developers`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("pages.developers.back")}
      </Link>

      <div className="flex flex-wrap gap-2 text-sm">
        {developer.isVerified ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800 ring-1 ring-amber-600/15 ring-inset">
            {t("common.verified")}
          </span>
        ) : null}
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-500/15 ring-inset">
          {t("pages.developers.listingCount", { count: listings.length })}
        </span>
        {projects.length > 0 ? (
          <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-800 ring-1 ring-violet-600/15 ring-inset">
            {t("pages.developers.projectCount", { count: projects.length })}
          </span>
        ) : null}
        {developer.website ? (
          <a
            href={developer.website}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800 ring-1 ring-emerald-600/15 ring-inset hover:underline"
          >
            {t("listing.website")}
          </a>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("pages.developers.listingsHeading")}
        </h2>
        <PageDirectory
          items={listingItems}
          emptyMessage={t("pages.developers.emptyListings")}
          layout="grid"
        />
      </section>

      {projectItems.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            {t("pages.developers.projectsHeading")}
          </h2>
          <PageDirectory
            items={projectItems}
            emptyMessage={t("pages.emptyDirectory")}
            layout="grid"
          />
        </section>
      ) : null}
    </PageIntro>
  );
}
