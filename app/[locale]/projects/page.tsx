import { PageDirectory, type DirectoryBadge } from "@/components/PageDirectory";
import { PageIntro } from "@/components/PageIntro";
import { fetchPublishedProjects } from "@/lib/catalog/queries";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/getDictionary";
import { pickLocalized } from "@/lib/i18n/pickLocalized";

/** DB-backed page — skip SSG so Vercel builds succeed without live Postgres. */
export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const projects = await fetchPublishedProjects();

  const items = projects.map((project) => {
    const subCity = project.subCity
      ? pickLocalized(project.subCity.name, locale) || project.subCity.code
      : "—";
    const stageLabel = project.constructionStage.replaceAll("_", " ");
    const completion = `${Number(project.completionPercent)}%`;

    const badges: DirectoryBadge[] = [
      { label: stageLabel, tone: "violet" },
      { label: completion, tone: "emerald" },
    ];

    return {
      id: project.id,
      title: pickLocalized(project.title, locale) || project.id,
      meta: [subCity, stageLabel, completion].join(" · "),
      badges,
      href: `/${locale}/projects/${encodeURIComponent(project.id)}`,
    };
  });

  return (
    <PageIntro
      eyebrow={dictionary.brand.name}
      title={dictionary.pages.projects.title}
      lede={dictionary.pages.projects.lede}
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
      <PageDirectory
        items={items}
        emptyMessage={translate(dictionary, "pages.emptyDirectory")}
        layout="grid"
      />
    </PageIntro>
  );
}
