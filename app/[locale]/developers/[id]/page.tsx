import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { DeveloperInventoryTree } from "@/components/developers/DeveloperInventoryTree";
import { DeveloperProfileHeader } from "@/components/developers/DeveloperProfileHeader";
import { PageDirectory } from "@/components/PageDirectory";
import { PageIntro } from "@/components/PageIntro";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { getSession } from "@/lib/auth/session";
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
import { buildPageMetadata } from "@/lib/seo/build-metadata";

export const dynamic = "force-dynamic";

function formatLicenseExpiry(value: Date | null | undefined, locale: Locale) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale: raw, id } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const developer = await fetchDeveloperById(id);
  if (!developer) {
    return { title: translate(dictionary, "pages.developers.title") };
  }

  const name =
    pickLocalized(developer.displayName, locale) || developer.tradeName;
  const hq = developer.headquartersSubCity
    ? pickLocalized(developer.headquartersSubCity.name, locale) ||
      developer.headquartersSubCity.code
    : null;

  const description =
    locale === "en"
      ? `Verified developer ${name}${hq ? ` based in ${hq}` : ""} — off-plan and completed inventory for diaspora and investors on EthioMLS.`
      : translate(dictionary, "pages.developers.detailLede", {
          area: hq || name,
        });

  return buildPageMetadata({
    locale,
    path: `/developers/${encodeURIComponent(id)}`,
    title:
      locale === "en"
        ? `${name} | Verified Developer | EthioMLS`
        : name,
    description,
    keywords: [
      name,
      developer.tradeName,
      "Addis Ababa developer",
      "Ethiopia real estate developer",
      "diaspora property Ethiopia",
    ].filter(Boolean) as string[],
  });
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

  const [listings, projects, session, admin] = await Promise.all([
    fetchPublishedListingsByDeveloper(developer.id),
    fetchPublishedProjectsByDeveloper(developer.id),
    getSession(),
    getCurrentAdmin(),
  ]);

  const canEditInventory = Boolean(
    admin || (session && session.userId === developer.userId),
  );

  const name =
    pickLocalized(developer.displayName, locale) || developer.tradeName;
  const hq = developer.headquartersSubCity
    ? pickLocalized(developer.headquartersSubCity.name, locale) ||
      developer.headquartersSubCity.code
    : null;
  const base = `/${locale}`;
  const licenseExpiry = formatLicenseExpiry(
    developer.licenseExpiresAt,
    locale,
  );

  const facts = [
    hq
      ? {
          label: t("pages.developers.facts.headquarters"),
          value: hq,
          kind: "hq" as const,
        }
      : null,
    developer.registrationNumber
      ? {
          label: t("pages.developers.facts.registration"),
          value: developer.registrationNumber,
        }
      : null,
    developer.licenseNumber
      ? {
          label: t("pages.developers.facts.license"),
          value: licenseExpiry
            ? `${developer.licenseNumber} · ${t("pages.developers.facts.expires", { date: licenseExpiry })}`
            : developer.licenseNumber,
        }
      : null,
    developer.tin
      ? {
          label: t("pages.developers.facts.tin"),
          value: developer.tin,
        }
      : null,
    developer.website
      ? {
          label: t("listing.website"),
          value: developer.website.replace(/^https?:\/\//i, ""),
          href: developer.website,
          external: true,
        }
      : null,
  ].filter((fact): fact is NonNullable<typeof fact> => Boolean(fact));

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
      imageUrl: project.coverImageUrl || undefined,
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

      <DeveloperProfileHeader
        name={name}
        tradeName={developer.tradeName}
        verified={developer.isVerified}
        verifiedLabel={t("common.verified")}
        facts={facts}
        badges={[
          {
            label: t("pages.developers.listingCount", {
              count: listings.length,
            }),
            tone: "emerald" as const,
          },
          ...(projects.length > 0
            ? [
                {
                  label: t("pages.developers.projectCount", {
                    count: projects.length,
                  }),
                  tone: "violet" as const,
                },
              ]
            : []),
        ]}
      />

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
          canEditInventory={canEditInventory}
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
            updateFailed: t("pages.developers.inventory.updateFailed"),
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
