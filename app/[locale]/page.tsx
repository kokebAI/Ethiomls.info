"use client";

import { useState } from "react";
import { BuildingScrollView } from "@/components/building/building-scroll-view";
import {
  ConversationalFunnel,
  type ConversationalSearchResult,
} from "@/components/search/conversational-funnel";
import { useTranslation } from "@/hooks/useTranslation";
import { DEMO_BUILDING } from "@/lib/building/demo";
import { formatMoney } from "@/lib/compliance/currency";

export default function LocaleHomePage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState<ConversationalSearchResult | null>(null);

  return (
    <div className="home">
      <section className="home__intro">
        <p className="home__eyebrow">{t("brand.name")}</p>
        <h1 className="home__title">{t("brand.tagline")}</h1>
      </section>

      <ConversationalFunnel onComplete={setSearch} />

      {search ? (
        <p className="home__search-result" role="status">
          {t("search.summary.intent")}: <strong>{search.intent}</strong>
          {" · "}
          {t("search.summary.cluster")}: <strong>{search.clusterId}</strong>
          {" · "}
          {t("search.summary.budget")}:{" "}
          <strong>
            {formatMoney(search.budgetEtb, "ETB")} /{" "}
            {formatMoney(search.budgetUsd, "USD")}
          </strong>
        </p>
      ) : null}

      <BuildingScrollView building={DEMO_BUILDING} />
    </div>
  );
}
