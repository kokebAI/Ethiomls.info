/**
 * National Bank of Ethiopia USD/ETB day-rate proxy.
 * Prefer `NBE_USD_ETB_RATE` env when wired to a live NBE feed; otherwise use
 * the tracked proxy baseline so foreigner-eligibility stays deterministic.
 */
const PROXY_BASELINE_USD_ETB = 128.75;

export type NbeDayRate = {
  usdEtb: number;
  source: "env" | "proxy";
  asOf: string;
};

export function getNbeUsdEtbDayRate(): NbeDayRate {
  const fromEnv = Number(process.env.NBE_USD_ETB_RATE);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return {
      usdEtb: fromEnv,
      source: "env",
      asOf: new Date().toISOString().slice(0, 10),
    };
  }

  return {
    usdEtb: PROXY_BASELINE_USD_ETB,
    source: "proxy",
    asOf: new Date().toISOString().slice(0, 10),
  };
}

/** Convert listing price into USD using the NBE day-rate proxy. */
export function toUsdEquivalent(
  amount: number,
  currency: "ETB" | "USD",
  rate: NbeDayRate = getNbeUsdEtbDayRate(),
): number {
  if (currency === "USD") return amount;
  return amount / rate.usdEtb;
}
