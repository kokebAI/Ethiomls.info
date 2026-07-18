/**
 * Client-safe NBE day-rate helpers.
 * The live rate comes from `/api/exchange-rate` (official NBE feed, 1-hour
 * server cache); these helpers only provide the resolution/fallback chain.
 */

export const NBE_USD_ETB_PROXY_BASELINE = 160.0;

export type NbeDayRateView = {
  usdEtb: number;
  source: "nbe" | "env" | "proxy";
  asOf: string;
};

export function resolveNbeUsdEtbRate(
  override?: number | null,
): NbeDayRateView {
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return {
      usdEtb: override,
      source: "env",
      asOf: new Date().toISOString().slice(0, 10),
    };
  }

  const fromPublic =
    typeof process !== "undefined"
      ? Number(process.env.NEXT_PUBLIC_NBE_USD_ETB_RATE)
      : NaN;

  if (Number.isFinite(fromPublic) && fromPublic > 0) {
    return {
      usdEtb: fromPublic,
      source: "env",
      asOf: new Date().toISOString().slice(0, 10),
    };
  }

  return {
    usdEtb: NBE_USD_ETB_PROXY_BASELINE,
    source: "proxy",
    asOf: new Date().toISOString().slice(0, 10),
  };
}

export function convertBudget(
  amount: number,
  from: "ETB" | "USD",
  to: "ETB" | "USD",
  rate: NbeDayRateView = resolveNbeUsdEtbRate(),
): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  if (from === to) return amount;
  if (from === "USD" && to === "ETB") return amount * rate.usdEtb;
  return amount / rate.usdEtb;
}

export function formatMoney(amount: number, currency: "ETB" | "USD"): string {
  const rounded = currency === "ETB" ? Math.round(amount) : Math.round(amount * 100) / 100;
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ETB" ? 0 : 2,
  }).format(rounded);
}
