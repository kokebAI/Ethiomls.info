import { notFound } from "next/navigation";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { ProjectBuildingDetail } from "@/app/[locale]/projects/[id]/project-building-detail";
import {
  projectToBuilding,
  projectWalkthroughMeta,
} from "@/lib/catalog/project-building";
import { fetchProjectById } from "@/lib/catalog/queries";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/getDictionary";
import { pickLocalized } from "@/lib/i18n/pickLocalized";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const project = await fetchProjectById(decodeURIComponent(id));

  if (!project) {
    notFound();
  }

  const building = projectToBuilding(project, locale);
  const walkthrough = projectWalkthroughMeta(project);
  const title = pickLocalized(project.title, locale) || project.id;
  const lede = pickLocalized(project.description, locale);
  const developerName =
    pickLocalized(project.developer.displayName, locale) ||
    project.developer.tradeName;
  const stageLabel = project.constructionStage.replaceAll("_", " ");
  const website =
    (typeof walkthrough.website === "string" && walkthrough.website) ||
    project.developer.website;
  const telegram =
    typeof walkthrough.telegram === "string" ? walkthrough.telegram : null;
  const projectAmenities = Array.isArray(walkthrough.amenities)
    ? walkthrough.amenities.filter((a): a is string => typeof a === "string")
    : [];

  return (
    <PageIntro
      eyebrow={dictionary.brand.name}
      title={title}
      lede={lede || dictionary.pages.projects.lede}
      motto={dictionary.brand.motto}
    >
      <p className="text-sm">
        <Link
          href={`/${locale}/projects`}
          className="font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          ← {dictionary.pages.projects.title}
        </Link>
      </p>

      <p className="font-mono text-xs text-slate-500 sm:text-sm">{project.id}</p>

      <ProjectBuildingDetail
        building={building}
        stageLabel={stageLabel}
        completionPercent={Number(project.completionPercent)}
        developerName={developerName}
        telegram={telegram}
        website={website}
        projectAmenities={projectAmenities}
      />

      {project.listings.length === 0 ? (
        <p className="text-sm text-slate-600" role="status">
          {translate(dictionary, "pages.emptyDirectory")}
        </p>
      ) : null}
    </PageIntro>
  );
}
