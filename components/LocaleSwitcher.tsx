"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
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
    <div className="locale-switcher" ref={rootRef}>
      <button
        type="button"
        className="locale-switcher__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t("locale.switchTo")}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="locale-switcher__code">{current.short}</span>
        <span className="locale-switcher__name">{current.native}</span>
        <span className="locale-switcher__chevron" aria-hidden="true" />
      </button>

      {open ? (
        <ul
          id={listId}
          className="locale-switcher__menu"
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
                  className={
                    selected
                      ? "locale-switcher__option locale-switcher__option--active"
                      : "locale-switcher__option"
                  }
                  onClick={() => selectLocale(code)}
                >
                  <span>{meta.native}</span>
                  <span className="locale-switcher__option-en">
                    {meta.english}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
