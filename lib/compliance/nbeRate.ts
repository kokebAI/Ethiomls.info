/**
 * National Bank of Ethiopia USD/ETB indicative day rate.
 *
 * Primary source: the official NBE JSON endpoint
 *   https://api.nbe.gov.et/api/filter-exchange-rates?date=YYYY-MM-DD
 * (same endpoint used by https://nbe.gov.et/exchange/indicatives-rates/).
 *
 * Fallback order: fresh live fetch → last cached live value → NBE_USD_ETB_RATE
 * env → static proxy baseline.
 */
const PROXY_BASELINE_USD_ETB = 160.0;

/** Plausibility window for USD/ETB — reject wildly wrong data. */
const MIN_PLAUSIBLE_RATE = 50;
const MAX_PLAUSIBLE_RATE = 500;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour, per the NBE sync instruction
const LOOKBACK_DAYS = 7;

export type NbeDayRate = {
  usdEtb: number;
  source: "nbe" | "env" | "proxy";
  asOf: string;
};

type NbeApiRow = {
  buying?: string;
  selling?: string;
  weighted_average?: string;
  date?: string;
  currency?: { code?: string };
};

let cachedLiveRate: NbeDayRate | null = null;
let cachedAtMs = 0;
let inflight: Promise<NbeDayRate | null> | null = null;

function isoDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

async function fetchNbeRateForDate(date: string): Promise<NbeDayRate | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(
      `https://api.nbe.gov.et/api/filter-exchange-rates?date=${date}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "EthioMLS/1.0 rate-sync",
        },
      },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      success?: boolean;
      data?: NbeApiRow[];
    };
    if (!payload.success || !Array.isArray(payload.data)) return null;

    const usdRows = payload.data.filter(
      (row) => row.currency?.code === "USD",
    );
    if (usdRows.length !== 1) return null;

    const row = usdRows[0];
    const weighted = Number(row.weighted_average);
    const buying = Number(row.buying);
    const selling = Number(row.selling);

    if (
      !Number.isFinite(weighted) ||
      weighted < MIN_PLAUSIBLE_RATE ||
      weighted > MAX_PLAUSIBLE_RATE
    ) {
      return null;
    }
    if (Number.isFinite(buying) && Number.isFinite(selling)) {
      if (buying > selling) return null;
      if (weighted < buying - 0.05 || weighted > selling + 0.05) return null;
    }

    const asOf = row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
      ? row.date
      : date;
    if (asOf > isoDaysAgo(0)) return null;

    return { usdEtb: weighted, source: "nbe", asOf };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLatestNbeRate(): Promise<NbeDayRate | null> {
  for (let back = 0; back <= LOOKBACK_DAYS; back += 1) {
    const rate = await fetchNbeRateForDate(isoDaysAgo(back));
    if (rate) return rate;
  }
  return null;
}

/**
 * Latest official NBE USD/ETB rate with an in-process 1-hour cache.
 * Never throws — degrades to env override, then the static baseline.
 */
export async function getLiveNbeUsdEtbRate(): Promise<NbeDayRate> {
  const now = Date.now();
  if (cachedLiveRate && now - cachedAtMs < CACHE_TTL_MS) {
    return cachedLiveRate;
  }

  if (!inflight) {
    inflight = fetchLatestNbeRate().finally(() => {
      inflight = null;
    });
  }

  const live = await inflight;
  if (live) {
    cachedLiveRate = live;
    cachedAtMs = now;
    return live;
  }

  // Stale cache beats env/baseline — it is still a verified NBE observation.
  if (cachedLiveRate) return cachedLiveRate;
  return getNbeUsdEtbDayRate();
}

/** Synchronous fallback: env override or static proxy baseline. */
export function getNbeUsdEtbDayRate(): NbeDayRate {
  if (cachedLiveRate) return cachedLiveRate;

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

/** Convert listing price into USD using the NBE day rate. */
export function toUsdEquivalent(
  amount: number,
  currency: "ETB" | "USD",
  rate: NbeDayRate = getNbeUsdEtbDayRate(),
): number {
  if (currency === "USD") return amount;
  return amount / rate.usdEtb;
}
