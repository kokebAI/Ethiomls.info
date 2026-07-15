"use client";

import { BuildingScrollView } from "@/components/building/building-scroll-view";
import { PageIntro } from "@/components/PageIntro";
import { ConversationalFunnel } from "@/components/search/conversational-funnel";
import { useTranslation } from "@/hooks/useTranslation";
import { DEMO_BUILDING } from "@/lib/building/demo";

export default function ListingsPage() {
  const { t } = useTranslation();

  return (
    <PageIntro
      eyebrow={t("brand.name")}
      title={t("pages.listings.title")}
      lede={t("pages.listings.lede")}
    >
      <p className="page-shell__note" role="status">
        {t("pages.comingOnline")}
      </p>
      <ConversationalFunnel />
      <BuildingScrollView building={DEMO_BUILDING} />
    </PageIntro>
  );
}
