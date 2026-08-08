/**
 * Sitewide display-currency preference (ETB | USD), persisted like locale.
 */

import {
  convertBudget,
  formatMoney,
  resolveNbeUsdEtbRate,
  type NbeDayRateView,
} from "@/lib/compliance/currency";
import {
  formatPriceBand,
  priceBandSortKey,
  type PriceBandListingType,
  type PriceCurrency,
} from "@/lib/catalog/price-band";

export type DisplayCurrency = "ETB" | "USD";

export const CURRENCY_COOKIE = "CURRENCY_PREF";
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseDisplayCurrency(raw: unknown): DisplayCurrency {
  return String(raw ?? "")
    .trim()
    .toUpperCase() === "USD"
    ? "USD"
    : "ETB";
}

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return value === "ETB" || value === "USD";
}

export function convertToDisplayCurrency(
  amount: number,
  from: PriceCurrency,
  preferred: DisplayCurrency,
  rate: NbeDayRateView = resolveNbeUsdEtbRate(),
): { amount: number; currency: DisplayCurrency } {
  return {
    amount: convertBudget(amount, from, preferred, rate),
    currency: preferred,
  };
}

/** Exact list price formatted in the visitor's preferred currency. */
export function formatListingMoney(
  amount: number,
  from: PriceCurrency,
  preferred: DisplayCurrency,
  rate: NbeDayRateView = resolveNbeUsdEtbRate(),
): string {
  const converted = convertToDisplayCurrency(amount, from, preferred, rate);
  return formatMoney(converted.amount, converted.currency);
}

/** Anonymous price band, converted into the preferred currency first. */
export function formatListingPriceBand(
  amount: number,
  from: PriceCurrency,
  preferred: DisplayCurrency,
  listingType: PriceBandListingType = "SALE",
  rate: NbeDayRateView = resolveNbeUsdEtbRate(),
): string {
  const converted = convertToDisplayCurrency(amount, from, preferred, rate);
  return formatPriceBand(converted.amount, converted.currency, listingType);
}

export function listingPriceSortKey(
  amount: number,
  from: PriceCurrency,
  preferred: DisplayCurrency,
  listingType: PriceBandListingType = "SALE",
  rate: NbeDayRateView = resolveNbeUsdEtbRate(),
): number {
  const converted = convertToDisplayCurrency(amount, from, preferred, rate);
  return priceBandSortKey(converted.amount, converted.currency, listingType);
}

export function currencyCookieWriteScript(preferred: DisplayCurrency): string {
  return `${CURRENCY_COOKIE}=${preferred};path=/;max-age=${CURRENCY_COOKIE_MAX_AGE};samesite=lax`;
}
