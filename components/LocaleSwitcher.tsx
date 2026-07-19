"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { localeLabels, locales, type Locale } from "@/lib/i18n/config";
import { useTranslation } from "@/hooks/useTranslation";

function swapLocaleInPath(pathname: string, nextLocale: Locale): string {
  const segments = pathname.split("/");
  if (segments.length > 1 && segments[1]) {
    segments[1] = nextLocale;
    return segments.join("/") || `/${nextLocale}`;
  }
  return `/${nextLocale}`;
}

export function LocaleSwitcher() {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = localeLabels[locale];

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

  function selectLocale(next: Locale) {
    if (next === locale) {
      setOpen(false);
      return;
    }

    const href = swapLocaleInPath(pathname || `/${locale}`, next);
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;samesite=lax`;
    setOpen(false);
    startTransition(() => {
      router.push(href);
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-left shadow-sm transition hover:border-brand-200 hover:ring-2 hover:ring-brand-100 sm:max-w-none sm:gap-2 sm:px-3"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t("locale.switchTo")}: ${current.native}`}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex min-w-[1.75rem] shrink-0 items-center justify-center rounded-full bg-brand-100 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-brand-800">
          {current.short}
        </span>
        <span className="hidden truncate text-sm font-semibold text-slate-800 sm:inline">
          {current.native}
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
          aria-label={t("locale.label")}
        >
          {locales.map((code) => {
            const meta = localeLabels[code];
            const selected = code === locale;
            return (
              <li key={code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition ${
                    selected
                      ? "bg-brand-50 text-brand-800"
                      : "text-slate-800 hover:bg-slate-50"
                  }`}
                  onClick={() => selectLocale(code)}
                >
                  <span className="text-sm font-semibold leading-snug">{meta.native}</span>
                  <span className="text-xs text-slate-500">{meta.english}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
