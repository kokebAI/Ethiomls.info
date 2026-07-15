"use client";

import { PageIntro } from "@/components/PageIntro";
import { useTranslation } from "@/hooks/useTranslation";

const SAMPLE_PROJECTS = [
  {
    id: "sunshine-heights",
    name: "Sunshine Heights",
    stage: "SUPERSTRUCTURE",
    subCity: "bole",
    completion: 62,
  },
  {
    id: "rift-valley-plaza",
    name: "Rift Valley Plaza",
    stage: "MEP_INSTALLATION",
    subCity: "yeka",
    completion: 78,
  },
  {
    id: "highland-courts",
    name: "Highland Courts",
    stage: "EARTHWORKS_FOUNDATION",
    subCity: "kirkos",
    completion: 18,
  },
] as const;

export default function ProjectsPage() {
  const { t } = useTranslation();

  return (
    <PageIntro
      eyebrow={t("brand.name")}
      title={t("pages.projects.title")}
      lede={t("pages.projects.lede")}
    >
      <p className="page-shell__note" role="status">
        {t("pages.emptyHint")}
      </p>
      <ul className="page-directory">
        {SAMPLE_PROJECTS.map((project) => (
          <li key={project.id} className="page-directory__card">
            <h2 className="page-directory__title">{project.name}</h2>
            <p className="page-directory__meta">
              {project.subCity}
              {" · "}
              {project.stage.replaceAll("_", " ")}
              {" · "}
              {project.completion}%
            </p>
          </li>
        ))}
      </ul>
    </PageIntro>
  );
}
