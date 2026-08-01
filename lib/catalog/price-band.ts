/**
 * Price bands for anonymous buyer teasers — never expose exact list prices.
 * Sale/off-plan and rent use different bucket scales.
 */

export type PriceCurrency = "ETB" | "USD";
export type PriceBandListingType = "SALE" | "RENT" | "OFF_PLAN" | string;

type Band = { min: number; max: number | null };

/** Sale / off-plan ETB buckets (birr). */
const SALE_ETB: Band[] = [
  { min: 0, max: 1_000_000 },
  { min: 1_000_000, max: 2_000_000 },
  { min: 2_000_000, max: 3_000_000 },
  { min: 3_000_000, max: 5_000_000 },
  { min: 5_000_000, max: 8_000_000 },
  { min: 8_000_000, max: 12_000_000 },
  { min: 12_000_000, max: 20_000_000 },
  { min: 20_000_000, max: 35_000_000 },
  { min: 35_000_000, max: null },
];

/** Monthly rent ETB buckets. */
const RENT_ETB: Band[] = [
  { min: 0, max: 15_000 },
  { min: 15_000, max: 25_000 },
  { min: 25_000, max: 40_000 },
  { min: 40_000, max: 60_000 },
  { min: 60_000, max: 100_000 },
  { min: 100_000, max: 150_000 },
  { min: 150_000, max: 250_000 },
  { min: 250_000, max: null },
];

/** Sale / off-plan USD buckets. */
const SALE_USD: Band[] = [
  { min: 0, max: 25_000 },
  { min: 25_000, max: 50_000 },
  { min: 50_000, max: 75_000 },
  { min: 75_000, max: 100_000 },
  { min: 100_000, max: 150_000 },
  { min: 150_000, max: 250_000 },
  { min: 250_000, max: 400_000 },
  { min: 400_000, max: null },
];

/** Monthly rent USD buckets. */
const RENT_USD: Band[] = [
  { min: 0, max: 200 },
  { min: 200, max: 400 },
  { min: 400, max: 700 },
  { min: 700, max: 1_000 },
  { min: 1_000, max: 1_500 },
  { min: 1_500, max: 2_500 },
  { min: 2_500, max: null },
];

function isRent(listingType: PriceBandListingType): boolean {
  return listingType === "RENT";
}

function bandsFor(
  currency: PriceCurrency,
  listingType: PriceBandListingType,
): Band[] {
  if (currency === "USD") {
    return isRent(listingType) ? RENT_USD : SALE_USD;
  }
  return isRent(listingType) ? RENT_ETB : SALE_ETB;
}

function findBand(
  amount: number,
  currency: PriceCurrency,
  listingType: PriceBandListingType,
): Band {
  const bands = bandsFor(currency, listingType);
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  for (const band of bands) {
    if (band.max == null) return band;
    if (safe < band.max) return band;
  }
  return bands[bands.length - 1]!;
}

function formatCompact(value: number, currency: PriceCurrency): string {
  if (currency === "ETB") {
    if (value >= 1_000_000) {
      const m = value / 1_000_000;
      const text = Number.isInteger(m) ? String(m) : m.toFixed(1).replace(/\.0$/, "");
      return `${text}M`;
    }
    if (value >= 1_000) {
      const k = value / 1_000;
      const text = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, "");
      return `${text}K`;
    }
    return String(Math.round(value));
  }

  if (value >= 1_000) {
    const k = value / 1_000;
    const text = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, "");
    return `${text}K`;
  }
  return String(Math.round(value));
}

/**
 * Human-readable price band for anonymous teasers, e.g. "ETB 4–5M" or "USD 700–1K / mo".
 */
export function formatPriceBand(
  amount: number,
  currency: PriceCurrency,
  listingType: PriceBandListingType = "SALE",
): string {
  const band = findBand(amount, currency, listingType);
  const suffix = isRent(listingType) ? " / mo" : "";

  if (band.max == null) {
    return `${currency} ${formatCompact(band.min, currency)}+${suffix}`;
  }
  if (band.min <= 0) {
    return `${currency} under ${formatCompact(band.max, currency)}${suffix}`;
  }
  return `${currency} ${formatCompact(band.min, currency)}–${formatCompact(band.max, currency)}${suffix}`;
}

/**
 * Midpoint of the band for anonymous client-side filter/sort (not the true price).
 */
export function priceBandSortKey(
  amount: number,
  currency: PriceCurrency,
  listingType: PriceBandListingType = "SALE",
): number {
  const band = findBand(amount, currency, listingType);
  if (band.max == null) {
    return band.min * 1.25;
  }
  if (band.min <= 0) {
    return band.max / 2;
  }
  return (band.min + band.max) / 2;
}
