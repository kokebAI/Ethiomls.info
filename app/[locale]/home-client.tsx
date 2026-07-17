"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ConversationalFunnel,
  type ConversationalSearchResult,
} from "@/components/search/conversational-funnel";
import { BrandMottoBanner } from "@/components/BrandMottoBanner";
import { useTranslation } from "@/hooks/useTranslation";
import type { HomeStats } from "@/lib/catalog/home-stats";

/** Animated count-up for hero stat numbers. */
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
      // Ease-out cubic so large numbers settle smoothly.
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
  ];

  /** Send buyers straight to the listings page with their filters applied. */
  function handleSearchComplete(result: ConversationalSearchResult) {
    const params = new URLSearchParams({
      type: INTENT_TO_LISTING_TYPE[result.intent],
      max: String(Math.round(result.budgetEtb)),
      subCities: result.subCities.join(","),
    });
    router.push(`${base}/listings?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-12">
      <BrandMottoBanner motto={t("brand.motto")} className="animate-rise-in" />

      <section className="animate-rise-in max-w-3xl space-y-4 sm:space-y-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
          {t("brand.name")}
        </p>
        <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-slate-deep sm:text-4xl lg:text-5xl">
          {t("brand.tagline")}
        </h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-ink-muted sm:text-base">
          {t("home.lede")}
        </p>
        <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:gap-3">
          <Link
            href={`${base}/listings`}
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-brand-700"
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
      </section>

      <section aria-label={t("home.statsHeading")} className="animate-rise-in">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {statCards.map((card) => (
            <article
              key={card.id}
              className="flex flex-col gap-1.5 rounded-2xl border border-slate-200/90 bg-white/85 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm sm:p-5"
            >
              <p className="text-3xl font-bold tracking-tight text-slate-deep sm:text-4xl">
                <StatNumber value={card.value} />
              </p>
              <h3 className="text-xs font-semibold text-ink-muted sm:text-sm">
                {card.label}
              </h3>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-[var(--shadow-card)] sm:p-6">
        <ConversationalFunnel onComplete={handleSearchComplete} />
      </section>
    </div>
  );
}
