"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Landmark, BadgeCheck } from "lucide-react";
import {
  ConversationalFunnel,
  type ConversationalSearchResult,
} from "@/components/search/conversational-funnel";
import { BrandMark } from "@/components/BrandMark";
import { useTranslation } from "@/hooks/useTranslation";
import type { HomeStats } from "@/lib/catalog/home-stats";

/** Animated count-up — only used when value > 0. */
function StatNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (value <= 0) {
      setDisplay(0);
      return;
    }
    const durationMs = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

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
};

export function HomeClient({ stats }: HomeClientProps) {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const base = `/${locale}`;

  const statCards = [
    { id: "listings", label: t("home.stats.listings"), value: stats.liveListings },
    { id: "projects", label: t("home.stats.projects"), value: stats.publishedProjects },
    {
      id: "developers",
      label: t("home.stats.developers"),
      value: stats.verifiedDevelopers,
    },
    { id: "subCities", label: t("home.stats.subCities"), value: stats.subCities },
  ].filter((card) => card.value > 0);

  const showMarketEmpty = statCards.length === 0;

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
    <div className="flex w-full min-w-0 flex-col gap-10 sm:gap-14">
      {/* Verified Gateway — brand first, then promise, seals, CTAs */}
      <section className="animate-rise-in grid w-full gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end lg:gap-10">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <BrandMark className="h-12 w-12" title={t("brand.name")} />
            <p className="text-lg font-bold tracking-tight text-slate-deep sm:text-xl">
              {t("brand.name")}
            </p>
          </div>

          <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-slate-deep sm:text-4xl lg:text-5xl">
            {t("brand.tagline")}
          </h1>

          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-ink sm:text-base">
            {t("home.lede")}
          </p>

          <ul className="flex flex-wrap gap-2" aria-label={t("home.trustHeading")}>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t("home.trust.verified")}
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-deep">
              <Landmark className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
              {t("home.trust.escrow")}
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-deep">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
              {t("home.trust.clearance")}
            </li>
          </ul>

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:gap-3">
            <Link
              href={`${base}/listings`}
              className="inline-flex items-center justify-center rounded-full bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              {t("home.browseCta")}
            </Link>
            <Link
              href={`${base}/listings/new`}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-50"
            >
              {t("home.listCta")}
            </Link>
          </div>
        </div>

        <aside
          className="relative overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#0F172A_0%,#1E293B_55%,#0F172A_100%)] px-5 py-6 shadow-[var(--shadow-card)] sm:px-6 sm:py-7"
          aria-label={t("brand.motto")}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 20%, #D97706 0%, transparent 42%), radial-gradient(circle at 90% 85%, #D97706 0%, transparent 36%)",
            }}
            aria-hidden="true"
          />
          <p className="relative font-ethiopic text-balance text-lg font-semibold leading-relaxed tracking-tight text-slate-50 sm:text-xl sm:leading-snug">
            <span className="text-brand-500" aria-hidden="true">
              “
            </span>
            {t("brand.motto")}
            <span className="text-brand-500" aria-hidden="true">
              ”
            </span>
          </p>
        </aside>
      </section>

      <ConversationalFunnel
        className="animate-rise-in"
        onComplete={handleSearchComplete}
      />

      {showMarketEmpty ? (
        <p className="animate-rise-in max-w-2xl text-sm leading-relaxed text-ink-muted">
          {t("home.emptyMarket")}
        </p>
      ) : (
        <section aria-label={t("home.statsHeading")} className="animate-rise-in">
          <h2 className="mb-4 text-base font-bold tracking-tight text-slate-deep sm:text-lg">
            {t("home.statsHeading")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {statCards.map((card) => (
              <article
                key={card.id}
                className="flex flex-col gap-1.5 rounded-2xl border border-slate-200/90 bg-white/85 p-4 shadow-[var(--shadow-card)] sm:p-5"
              >
                <p className="text-3xl font-bold tracking-tight text-slate-deep sm:text-4xl">
                  <StatNumber value={card.value} />
                </p>
                <p className="text-xs font-semibold text-ink-muted sm:text-sm">
                  {card.label}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
