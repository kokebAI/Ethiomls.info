"use client";

import { PageIntro } from "@/components/PageIntro";
import { useTranslation } from "@/hooks/useTranslation";

const SAMPLE_DEVELOPERS = [
  {
    id: "sunshine",
    name: "Sunshine Homes PLC",
    hq: "bole",
    verified: true,
  },
  {
    id: "rift",
    name: "Rift Valley Developers S.C.",
    hq: "yeka",
    verified: true,
  },
  {
    id: "highland",
    name: "Highland Estates PLC",
    hq: "kirkos",
    verified: true,
  },
] as const;

export default function DevelopersPage() {
  const { t } = useTranslation();

  return (
    <PageIntro
      eyebrow={t("brand.name")}
      title={t("pages.developers.title")}
      lede={t("pages.developers.lede")}
    >
      <p className="page-shell__note" role="status">
        {t("pages.emptyHint")}
      </p>
      <ul className="page-directory">
        {SAMPLE_DEVELOPERS.map((developer) => (
          <li key={developer.id} className="page-directory__card">
            <h2 className="page-directory__title">{developer.name}</h2>
            <p className="page-directory__meta">
              {developer.hq}
              {developer.verified ? ` · ${t("common.verified")}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </PageIntro>
  );
}
