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
import styles from "./conversational-funnel.module.css";

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
};

type ConversationalFunnelProps = {
  /** Optional NBE USD/ETB override (otherwise public env / proxy baseline). */
  nbeUsdEtbRate?: number;
  onComplete?: (result: ConversationalSearchResult) => void;
  className?: string;
};

const INTENT_OPTIONS: Array<{
  id: SearchIntent;
  labelKey: string;
  hintKey: string;
}> = [
  { id: "buy", labelKey: "search.intent.buy", hintKey: "search.intent.buyHint" },
  { id: "rent", labelKey: "search.intent.rent", hintKey: "search.intent.rentHint" },
  {
    id: "off_plan",
    labelKey: "search.intent.offPlan",
    hintKey: "search.intent.offPlanHint",
  },
];

type Step = 0 | 1 | 2;

/**
 * Step-by-step conversational search funnel for the index page:
 * Intent → Sub-city cluster → Target budget (with NBE cross-currency balance).
 */
export function ConversationalFunnel({
  nbeUsdEtbRate,
  onComplete,
  className,
}: ConversationalFunnelProps) {
  const { t } = useTranslation();
  const rate = useMemo(
    () => resolveNbeUsdEtbRate(nbeUsdEtbRate),
    [nbeUsdEtbRate],
  );

  const [step, setStep] = useState<Step>(0);
  const [intent, setIntent] = useState<SearchIntent | null>(null);
  const [clusterId, setClusterId] = useState<SubCityClusterId | null>(null);
  const [budgetCurrency, setBudgetCurrency] = useState<BudgetCurrency>("ETB");
  const [budgetInput, setBudgetInput] = useState("5000000");

  const amount = Number(budgetInput.replace(/,/g, ""));
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;

  const budgetEtb = convertBudget(safeAmount, budgetCurrency, "ETB", rate);
  const budgetUsd = convertBudget(safeAmount, budgetCurrency, "USD", rate);
  const counterpartCurrency: BudgetCurrency =
    budgetCurrency === "ETB" ? "USD" : "ETB";
  const counterpartAmount = budgetCurrency === "ETB" ? budgetUsd : budgetEtb;

  const cluster = SUB_CITY_CLUSTERS.find((item) => item.id === clusterId);

  function selectIntent(next: SearchIntent) {
    setIntent(next);
    setStep(1);
  }

  function selectCluster(next: SubCityClusterId) {
    setClusterId(next);
    setStep(2);
  }

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
    if (!intent || !cluster) return;
    onComplete?.({
      intent,
      clusterId: cluster.id,
      subCities: [...cluster.subCities],
      budgetAmount: safeAmount,
      budgetCurrency,
      budgetEtb,
      budgetUsd,
      nbeRate: rate.usdEtb,
    });
  }

  return (
    <section
      className={`${styles.root} ${className ?? ""}`.trim()}
      aria-labelledby="funnel-title"
    >
      <header className={styles.header}>
        <p className={styles.eyebrow}>{t("search.eyebrow")}</p>
        <h2 id="funnel-title" className={styles.title}>
          {t("search.title")}
        </h2>
        <p className={styles.lede}>{t("search.lede")}</p>
      </header>

      <ol className={styles.steps} aria-label={t("search.progressLabel")}>
        {[0, 1, 2].map((index) => (
          <li
            key={index}
            className={
              index === step
                ? `${styles.stepDot} ${styles.stepDotActive}`
                : index < step
                  ? `${styles.stepDot} ${styles.stepDotDone}`
                  : styles.stepDot
            }
            aria-current={index === step ? "step" : undefined}
          >
            <button
              type="button"
              className={styles.stepButton}
              disabled={index > step}
              onClick={() => setStep(index as Step)}
            >
              {index + 1}
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.panel} aria-live="polite">
        {step === 0 ? (
          <div className={styles.stage}>
            <h3 className={styles.prompt}>{t("search.prompts.intent")}</h3>
            <div className={styles.optionGrid}>
              {INTENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={
                    intent === option.id
                      ? `${styles.option} ${styles.optionActive}`
                      : styles.option
                  }
                  onClick={() => selectIntent(option.id)}
                >
                  <span className={styles.optionLabel}>{t(option.labelKey)}</span>
                  <span className={styles.optionHint}>{t(option.hintKey)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className={styles.stage}>
            <h3 className={styles.prompt}>{t("search.prompts.cluster")}</h3>
            <div className={styles.optionGrid}>
              {SUB_CITY_CLUSTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    clusterId === item.id
                      ? `${styles.option} ${styles.optionActive}`
                      : styles.option
                  }
                  onClick={() => selectCluster(item.id)}
                >
                  <span className={styles.optionLabel}>{t(item.labelKey)}</span>
                  <span className={styles.optionHint}>
                    {t(item.descriptionKey)}
                  </span>
                  <span className={styles.optionMeta}>
                    {item.subCities.join(" · ")}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.back}
              onClick={() => setStep(0)}
            >
              {t("search.back")}
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className={styles.stage}>
            <h3 className={styles.prompt}>{t("search.prompts.budget")}</h3>

            <div className={styles.currencyToggle} role="group">
              {(["ETB", "USD"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  className={
                    budgetCurrency === code
                      ? `${styles.currencyBtn} ${styles.currencyBtnActive}`
                      : styles.currencyBtn
                  }
                  onClick={() => toggleCurrency(code)}
                >
                  {code}
                </button>
              ))}
            </div>

            <label className={styles.budgetField}>
              <span className={styles.budgetLabel}>
                {t("search.budgetAmount")} ({budgetCurrency})
              </span>
              <input
                className={styles.budgetInput}
                inputMode="decimal"
                value={budgetInput}
                onChange={(event) => setBudgetInput(event.target.value)}
                aria-describedby="budget-balance"
              />
            </label>

            <div id="budget-balance" className={styles.balance}>
              <p className={styles.balancePrimary}>
                {t("search.budgetBalance")}{" "}
                <strong>
                  {formatMoney(counterpartAmount, counterpartCurrency)}
                </strong>
              </p>
              <p className={styles.balanceMeta}>
                {t("search.nbeRateLabel")}{" "}
                <strong>1 USD = {rate.usdEtb.toFixed(2)} ETB</strong>
                <span className={styles.rateSource}>
                  ({rate.source === "env" ? t("search.rateLive") : t("search.rateProxy")}
                  · {rate.asOf})
                </span>
              </p>
            </div>

            <div className={styles.summary}>
              <p>
                <span>{t("search.summary.intent")}</span>
                <strong>
                  {intent
                    ? t(
                        INTENT_OPTIONS.find((item) => item.id === intent)!
                          .labelKey,
                      )
                    : "—"}
                </strong>
              </p>
              <p>
                <span>{t("search.summary.cluster")}</span>
                <strong>
                  {cluster ? t(cluster.labelKey) : "—"}
                </strong>
              </p>
              <p>
                <span>{t("search.summary.budget")}</span>
                <strong>
                  {formatMoney(budgetEtb, "ETB")} / {formatMoney(budgetUsd, "USD")}
                </strong>
              </p>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.back}
                onClick={() => setStep(1)}
              >
                {t("search.back")}
              </button>
              <button
                type="button"
                className={styles.submit}
                disabled={safeAmount <= 0 || !intent || !cluster}
                onClick={submit}
              >
                {t("search.submit")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default ConversationalFunnel;
