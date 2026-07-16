"use client";

import { useMemo, useState } from "react";
import { BuildingScrollView } from "@/components/building/building-scroll-view";
import {
  ConversationalFunnel,
  type ConversationalSearchResult,
} from "@/components/search/conversational-funnel";
import { BrandMottoBanner } from "@/components/BrandMottoBanner";
import { useTranslation } from "@/hooks/useTranslation";
import { getDemoBuilding } from "@/lib/building/demo";
import { formatMoney } from "@/lib/compliance/currency";

type HomeClientProps = {
  children?: React.ReactNode;
};

export function HomeClient({ children }: HomeClientProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState<ConversationalSearchResult | null>(null);
  const building = useMemo(() => getDemoBuilding(t), [t]);

  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      <BrandMottoBanner motto={t("brand.motto")} className="animate-rise-in" />

      <section className="animate-rise-in max-w-3xl space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
          {t("brand.name")}
        </p>
        <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-slate-deep sm:text-4xl lg:text-5xl">
          {t("brand.tagline")}
        </h1>
      </section>

      {children}

      <section className="rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-[var(--shadow-card)] sm:p-6">
        <ConversationalFunnel onComplete={setSearch} />
      </section>

      {search ? (
        <p
          className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-sm leading-relaxed text-slate-700"
          role="status"
        >
          {t("search.summary.intent")}:{" "}
          <strong className="font-semibold text-slate-900">
            {search.intent === "buy"
              ? t("search.intent.buy")
              : search.intent === "rent"
                ? t("search.intent.rent")
                : t("search.intent.offPlan")}
          </strong>
          {" · "}
          {t("search.summary.cluster")}:{" "}
          <strong className="font-semibold text-slate-900">
            {t(`search.clusters.${search.clusterId}`)}
          </strong>
          {" · "}
          {t("search.summary.budget")}:{" "}
          <strong className="font-semibold text-slate-900">
            {formatMoney(search.budgetEtb, "ETB")} /{" "}
            {formatMoney(search.budgetUsd, "USD")}
          </strong>
          {search.aiSummary ? (
            <>
              <br />
              <span className="text-emerald-800">{search.aiSummary}</span>
            </>
          ) : null}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[var(--shadow-card)] sm:p-6">
        <BuildingScrollView building={building} />
      </section>
    </div>
  );
}
