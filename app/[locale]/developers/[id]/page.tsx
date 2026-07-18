import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { DeveloperInventoryTree } from "@/components/developers/DeveloperInventoryTree";
import { PageDirectory } from "@/components/PageDirectory";
import { PageIntro } from "@/components/PageIntro";
import { buildDeveloperInventoryTree } from "@/lib/catalog/developer-inventory";
import {
  fetchDeveloperById,
  fetchPublishedListingsByDeveloper,
  fetchPublishedProjectsByDeveloper,
} from "@/lib/catalog/queries";
import { formatConstructionStage } from "@/lib/domain/construction-stage";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/getDictionary";
import { pickLocalized } from "@/lib/i18n/pickLocalized";

export const dynamic = "force-dynamic";

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

  const inventoryParents = buildDeveloperInventoryTree({
    listings,
    locale,
    basePath: base,
    t,
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
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">
            {t("pages.developers.inventory.heading")}
          </h2>
          <p className="text-sm text-slate-600">
            {t("pages.developers.inventory.lede")}
          </p>
        </div>
        <DeveloperInventoryTree
          parents={inventoryParents}
          emptyMessage={t("pages.developers.emptyListings")}
          labels={{
            unitTypes: t("pages.developers.inventory.unitTypes"),
            available: t("pages.developers.inventory.available"),
            reserved: t("pages.developers.inventory.reserved"),
            sold: t("pages.developers.inventory.sold"),
            units: t("pages.developers.inventory.units"),
            viewUnit: t("pages.developers.inventory.viewUnit"),
            kindProject: t("pages.developers.inventory.kindProject"),
            kindBuilding: t("pages.developers.inventory.kindBuilding"),
            kindStandalone: t("pages.developers.inventory.kindStandalone"),
          }}
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
