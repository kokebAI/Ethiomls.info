"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrencyPreference } from "@/hooks/useCurrencyPreference";
import { useTranslation } from "@/hooks/useTranslation";
import type { DisplayCurrency } from "@/lib/currency/preference";

const OPTIONS: Array<{ code: DisplayCurrency; short: string; labelKey: string }> =
  [
    { code: "ETB", short: "ETB", labelKey: "currency.etb" },
    { code: "USD", short: "USD", labelKey: "currency.usd" },
  ];

export function CurrencySwitcher() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currency, setCurrency, rate } = useCurrencyPreference();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = OPTIONS.find((item) => item.code === currency) ?? OPTIONS[0]!;

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function selectCurrency(next: DisplayCurrency) {
    if (next === currency) {
      setOpen(false);
      return;
    }
    setCurrency(next);
    setOpen(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className="inline-flex max-w-[9.5rem] items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-left shadow-sm transition hover:border-brand-200 hover:ring-2 hover:ring-brand-100 sm:max-w-none sm:gap-2 sm:px-3"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t("currency.switchTo")}: ${t(current.labelKey)}`}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex min-w-[2.25rem] shrink-0 items-center justify-center rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-bold tracking-wide text-brand-800">
          {current.short}
        </span>
        <span className="hidden truncate text-sm font-semibold text-slate-800 lg:inline">
          {t(current.labelKey)}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition sm:h-4 sm:w-4 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
          id={listId}
          className="animate-locale-rise absolute right-0 top-[calc(100%+0.45rem)] z-50 min-w-[14rem] max-w-[min(18rem,calc(100vw-2rem))] list-none rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[var(--shadow-card-hover)]"
          role="listbox"
          aria-label={t("currency.label")}
        >
          {OPTIONS.map((option) => {
            const selected = option.code === currency;
            return (
              <li key={option.code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition ${
                    selected
                      ? "bg-brand-50 text-brand-800"
                      : "text-slate-800 hover:bg-slate-50"
                  }`}
                  onClick={() => selectCurrency(option.code)}
                >
                  <span className="text-sm font-semibold leading-snug">
                    {t(option.labelKey)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {option.code === "USD"
                      ? t("currency.usdHint")
                      : t("currency.etbHint")}
                  </span>
                </button>
              </li>
            );
          })}
          <li className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            1 USD ≈ {rate.usdEtb.toFixed(2)} ETB · {t("currency.nbeNote")}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
