"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  convertBudget,
  formatMoney,
  resolveNbeUsdEtbRate,
  type NbeDayRateView,
} from "@/lib/compliance/currency";
import {
  CURRENCY_COOKIE,
  currencyCookieWriteScript,
  formatListingMoney,
  formatListingPriceBand,
  parseDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/currency/preference";
import type { PriceBandListingType, PriceCurrency } from "@/lib/catalog/price-band";

type CurrencyPreferenceContextValue = {
  currency: DisplayCurrency;
  rate: NbeDayRateView;
  setCurrency: (next: DisplayCurrency) => void;
  formatListing: (
    amount: number,
    from: PriceCurrency,
    opts?: { band?: boolean; listingType?: PriceBandListingType },
  ) => string;
};

const CurrencyPreferenceContext =
  createContext<CurrencyPreferenceContextValue | null>(null);

function readCookieCurrency(): DisplayCurrency | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CURRENCY_COOKIE}=`));
  if (!match) return null;
  return parseDisplayCurrency(match.split("=")[1]);
}

export function CurrencyPreferenceProvider({
  initialCurrency = "ETB",
  initialRateUsdEtb,
  children,
}: {
  initialCurrency?: DisplayCurrency;
  initialRateUsdEtb?: number | null;
  children: ReactNode;
}) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(
    parseDisplayCurrency(initialCurrency),
  );
  const [liveRate, setLiveRate] = useState<number | null>(
    typeof initialRateUsdEtb === "number" ? initialRateUsdEtb : null,
  );

  const rate = useMemo(
    () => resolveNbeUsdEtbRate(liveRate),
    [liveRate],
  );

  useEffect(() => {
    const fromCookie = readCookieCurrency();
    if (fromCookie && fromCookie !== currency) {
      setCurrencyState(fromCookie);
    }
    // Sync once on mount from cookie (client may have older SSR default).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof initialRateUsdEtb === "number" && initialRateUsdEtb > 0) return;
    let cancelled = false;
    fetch("/api/exchange-rate")
      .then((response) => response.json())
      .then((payload: { data?: { rate?: number } }) => {
        const value = payload.data?.rate;
        if (
          !cancelled &&
          typeof value === "number" &&
          Number.isFinite(value) &&
          value > 0
        ) {
          setLiveRate(value);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialRateUsdEtb]);

  const setCurrency = useCallback((next: DisplayCurrency) => {
    setCurrencyState(next);
    document.cookie = currencyCookieWriteScript(next);
    window.dispatchEvent(
      new CustomEvent("ethiomls:currency-pref", { detail: next }),
    );
  }, []);

  const formatListing = useCallback(
    (
      amount: number,
      from: PriceCurrency,
      opts?: { band?: boolean; listingType?: PriceBandListingType },
    ) => {
      if (opts?.band) {
        return formatListingPriceBand(
          amount,
          from,
          currency,
          opts.listingType ?? "SALE",
          rate,
        );
      }
      return formatListingMoney(amount, from, currency, rate);
    },
    [currency, rate],
  );

  const value = useMemo(
    () => ({ currency, rate, setCurrency, formatListing }),
    [currency, rate, setCurrency, formatListing],
  );

  return createElement(
    CurrencyPreferenceContext.Provider,
    { value },
    children,
  );
}

export function useCurrencyPreference(): CurrencyPreferenceContextValue {
  const ctx = useContext(CurrencyPreferenceContext);
  if (!ctx) {
    // Fallback when used outside provider (tests / isolated stories).
    const currency: DisplayCurrency = "ETB";
    const rate = resolveNbeUsdEtbRate();
    return {
      currency,
      rate,
      setCurrency: () => {},
      formatListing: (amount, from, opts) =>
        opts?.band
          ? formatListingPriceBand(amount, from, currency, opts.listingType, rate)
          : formatListingMoney(amount, from, currency, rate),
    };
  }
  return ctx;
}

/** Convert an arbitrary amount into the active display currency. */
export function useConvertedAmount(
  amount: number,
  from: PriceCurrency,
): { amount: number; currency: DisplayCurrency; formatted: string } {
  const { currency, rate } = useCurrencyPreference();
  const converted = convertBudget(amount, from, currency, rate);
  return {
    amount: converted,
    currency,
    formatted: formatMoney(converted, currency),
  };
}
