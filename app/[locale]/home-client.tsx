"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Landmark, ShieldCheck, Headphones } from "lucide-react";
import {
  ConversationalFunnel,
  type ConversationalSearchResult,
} from "@/components/search/conversational-funnel";
import { VerifiedGatewaySeal } from "@/components/home/VerifiedGatewaySeal";
import { HomeTeaserGrid } from "@/components/home/HomeTeaserGrid";
import { useTranslation } from "@/hooks/useTranslation";
import type { HomeStats } from "@/lib/catalog/home-stats";
import type { HomeTeaser } from "@/lib/catalog/home-teasers";
import type { Locale } from "@/lib/i18n/config";

const INTENT_TO_LISTING_TYPE: Record<
  ConversationalSearchResult["intent"],
  string
> = {
  buy: "SALE",
  rent: "RENT",
  off_plan: "OFF_PLAN",
};

type HomeClientProps = {
  stats: HomeStats;
  teasers: HomeTeaser[];
};

export function HomeClient({ stats, teasers }: HomeClientProps) {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const base = `/${locale}`;
  const typedLocale = locale as Locale;

  const liveProof = [
    {
      id: "listings",
      label: t("home.stats.listings"),
      value: stats.liveListings,
    },
    {
      id: "developers",
      label: t("home.stats.developers"),
      value: stats.verifiedDevelopers,
    },
    {
      id: "projects",
      label: t("home.stats.projects"),
      value: stats.publishedProjects,
    },
  ].filter((item) => item.value > 0);

  function handleSearchComplete(result: ConversationalSearchResult) {
    const params = new URLSearchParams({
      type: INTENT_TO_LISTING_TYPE[result.intent],
      max: String(Math.round(result.budgetEtb)),
      subCities: result.subCities.join(","),
    });
    if (
      result.intent === "off_plan" &&
      typeof result.minCompletionPercent === "number" &&
      result.minCompletionPercent > 0
    ) {
      params.set("minCompletion", String(result.minCompletionPercent));
    }
    router.push(`${base}/listings?${params.toString()}`);
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-10 sm:gap-12">
      {/* Option B hero — seal + verified search promise */}
      <section className="animate-rise-in grid w-full items-center gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-12">
        <VerifiedGatewaySeal label={t("home.sealLabel")} />

        <div className="space-y-5">
          <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-slate-deep sm:text-4xl lg:text-5xl">
            {t("home.gatewayHeadline")}
          </h1>
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-ink sm:text-base">
            {t("home.gatewayLede")}
          </p>

          {liveProof.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {liveProof.map((item) => (
                <li
                  key={item.id}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-deep"
                >
                  <BadgeCheck
                    className="h-3.5 w-3.5 text-brand-700"
                    aria-hidden="true"
                  />
                  <span>
                    {item.label}: {item.value.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
            <a
              href="#gateway-search"
              className="inline-flex items-center justify-center rounded-full bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              {t("home.browseCta")}
            </a>
            <Link
              href={`${base}/listings/new`}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-50"
            >
              {t("home.listCta")}
            </Link>
          </div>
        </div>
      </section>

      <div id="gateway-search" className="scroll-mt-24">
        <ConversationalFunnel
          className="animate-rise-in"
          variant="gateway"
          onComplete={handleSearchComplete}
        />
      </div>

      <HomeTeaserGrid
        locale={typedLocale}
        teasers={teasers}
        heading={t("home.verifiedProperties")}
        emptyMessage={t("home.emptyMarket")}
        verifiedLabel={t("listing.verified")}
        viewAllLabel={t("home.viewAll")}
        typeLabels={{
          forSale: t("listing.forSale"),
          forRent: t("listing.forRent"),
          offPlan: t("listing.offPlan"),
        }}
      />

      <section
        aria-label={t("home.trustHeading")}
        className="animate-rise-in grid gap-4 rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-[var(--shadow-card)] sm:grid-cols-2 sm:p-5 lg:grid-cols-4"
      >
        {[
          {
            icon: ShieldCheck,
            title: t("home.banner.guaranteeTitle"),
            body: t("home.banner.guaranteeBody"),
          },
          {
            icon: BadgeCheck,
            title: t("home.banner.identitiesTitle"),
            body: t("home.banner.identitiesBody"),
          },
          {
            icon: Landmark,
            title: t("home.banner.documentsTitle"),
            body: t("home.banner.documentsBody"),
          },
          {
            icon: Headphones,
            title: t("home.banner.supportTitle"),
            body: t("home.banner.supportBody"),
          },
        ].map((item) => (
          <div key={item.title} className="flex gap-3">
            <item.icon
              className="mt-0.5 h-5 w-5 shrink-0 text-brand-700"
              aria-hidden="true"
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold text-slate-deep">{item.title}</p>
              <p className="text-xs leading-relaxed text-ink-muted">{item.body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
