"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  convertBudget,
  formatMoney,
  resolveNbeUsdEtbRate,
} from "@/lib/compliance/currency";
import {
  SUB_CITY_CLUSTERS,
  type SubCityClusterId,
} from "@/lib/search/clusters";

export type SearchIntent = "buy" | "rent" | "off_plan";
export type BudgetCurrency = "ETB" | "USD";

export type ConversationalSearchResult = {
  intent: SearchIntent;
  clusterId: SubCityClusterId;
  subCities: string[];
  budgetAmount: number;
  budgetCurrency: BudgetCurrency;
  budgetEtb: number;
  budgetUsd: number;
  nbeRate: number;
  aiSummary?: string;
};

type ConversationalFunnelProps = {
  nbeUsdEtbRate?: number;
  onComplete?: (result: ConversationalSearchResult) => void;
  className?: string;
};

const INTENT_OPTIONS: Array<{ id: SearchIntent; labelKey: string }> = [
  { id: "buy", labelKey: "search.intent.buy" },
  { id: "rent", labelKey: "search.intent.rent" },
  { id: "off_plan", labelKey: "search.intent.offPlan" },
];

/**
 * Single-panel guided search: intent + area + budget in one view.
 * Optional Gemini "Fill with AI" prefills the same fields.
 */
export function ConversationalFunnel({
  nbeUsdEtbRate,
  onComplete,
  className,
}: ConversationalFunnelProps) {
  const { locale, t } = useTranslation();
  const rate = useMemo(
    () => resolveNbeUsdEtbRate(nbeUsdEtbRate),
    [nbeUsdEtbRate],
  );

  const [intent, setIntent] = useState<SearchIntent>("buy");
  const [clusterId, setClusterId] = useState<SubCityClusterId>("east");
  const [budgetCurrency, setBudgetCurrency] = useState<BudgetCurrency>("ETB");
  const [budgetInput, setBudgetInput] = useState("5000000");
  const [aiQuery, setAiQuery] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAi, setShowAi] = useState(false);

  const amount = Number(budgetInput.replace(/,/g, ""));
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const budgetEtb = convertBudget(safeAmount, budgetCurrency, "ETB", rate);
  const budgetUsd = convertBudget(safeAmount, budgetCurrency, "USD", rate);
  const cluster = SUB_CITY_CLUSTERS.find((item) => item.id === clusterId)!;

  function toggleCurrency(next: BudgetCurrency) {
    if (next === budgetCurrency) return;
    const converted = convertBudget(safeAmount, budgetCurrency, next, rate);
    setBudgetCurrency(next);
    setBudgetInput(
      next === "ETB"
        ? String(Math.round(converted))
        : String(Math.round(converted * 100) / 100),
    );
  }

  function submit() {
    if (safeAmount <= 0) return;
    onComplete?.({
      intent,
      clusterId: cluster.id,
      subCities: [...cluster.subCities],
      budgetAmount: safeAmount,
      budgetCurrency,
      budgetEtb,
      budgetUsd,
      nbeRate: rate.usdEtb,
      aiSummary: aiSummary ?? undefined,
    });
  }

  async function runAiAssist() {
    const query = aiQuery.trim();
    if (query.length < 3 || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const response = await fetch("/api/ai/search-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, locale }),
      });
      const payload = (await response.json()) as {
        data?: {
          intent: SearchIntent;
          clusterId: SubCityClusterId;
          budgetAmount: number;
          budgetCurrency: BudgetCurrency;
          summary: string;
        };
        message?: string;
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.message ?? t("search.ai.error"));
      }
      const { data } = payload;
      setIntent(data.intent);
      setClusterId(data.clusterId);
      setBudgetCurrency(data.budgetCurrency);
      setBudgetInput(
        data.budgetCurrency === "ETB"
          ? String(Math.round(data.budgetAmount))
          : String(Math.round(data.budgetAmount * 100) / 100),
      );
      setAiSummary(data.summary);
      setShowAi(false);
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : t("search.ai.error"),
      );
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <section
      className={`grid w-full gap-5 ${className ?? ""}`.trim()}
      aria-labelledby="funnel-title"
    >
      <header className="max-w-2xl space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">
          {t("search.eyebrow")}
        </p>
        <h2
          id="funnel-title"
          className="text-balance text-2xl font-bold tracking-tight text-slate-deep sm:text-3xl"
        >
          {t("search.title")}
        </h2>
        <p className="text-pretty text-sm leading-relaxed text-ink-muted sm:text-base">
          {t("search.simpleLede")}
        </p>
      </header>

      <div className="grid gap-5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-slate-deep">
            {t("search.prompts.intent")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {INTENT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  intent === option.id
                    ? "bg-slate-deep text-white"
                    : "border border-slate-200 bg-white text-ink hover:border-brand-300"
                }`}
                onClick={() => setIntent(option.id)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-deep">
            {t("search.prompts.cluster")}
          </span>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-deep outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            value={clusterId}
            onChange={(event) =>
              setClusterId(event.target.value as SubCityClusterId)
            }
          >
            {SUB_CITY_CLUSTERS.map((item) => (
              <option key={item.id} value={item.id}>
                {t(item.labelKey)} — {item.subCities.join(", ")}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-deep">
              {t("search.prompts.budget")}
            </span>
            <div
              className="inline-flex gap-1 rounded-full bg-slate-100 p-1"
              role="group"
            >
              {(["ETB", "USD"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    budgetCurrency === code
                      ? "bg-slate-deep text-white"
                      : "text-ink-muted hover:text-slate-deep"
                  }`}
                  onClick={() => toggleCurrency(code)}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xl font-bold text-slate-deep outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            inputMode="decimal"
            value={budgetInput}
            onChange={(event) => setBudgetInput(event.target.value)}
            aria-label={t("search.budgetAmount")}
          />
          <p className="text-xs text-ink-muted">
            {t("search.budgetBalance")}{" "}
            <strong className="text-slate-deep">
              {formatMoney(
                budgetCurrency === "ETB" ? budgetUsd : budgetEtb,
                budgetCurrency === "ETB" ? "USD" : "ETB",
              )}
            </strong>
            {" · "}
            1 USD = {rate.usdEtb.toFixed(2)} ETB
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-45"
            disabled={safeAmount <= 0}
            onClick={submit}
          >
            {t("search.submit")}
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50"
            onClick={() => setShowAi((v) => !v)}
          >
            {t("search.ai.toggle")}
          </button>
          {aiSummary ? (
            <p className="text-pretty text-sm text-brand-800" role="status">
              {aiSummary}
            </p>
          ) : null}
        </div>

        {showAi ? (
          <div className="grid gap-2 rounded-xl border border-brand-200/70 bg-brand-50/40 p-3">
            <textarea
              className="min-h-[4rem] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              value={aiQuery}
              onChange={(event) => setAiQuery(event.target.value)}
              placeholder={t("search.ai.placeholder")}
              maxLength={800}
              disabled={aiBusy}
            />
            <button
              type="button"
              className="w-fit rounded-full bg-slate-deep px-4 py-2 text-sm font-semibold text-white disabled:opacity-45"
              disabled={aiBusy || aiQuery.trim().length < 3}
              onClick={() => void runAiAssist()}
            >
              {aiBusy ? t("search.ai.working") : t("search.ai.apply")}
            </button>
            {aiError ? (
              <p className="text-sm text-rose-700" role="alert">
                {aiError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default ConversationalFunnel;
