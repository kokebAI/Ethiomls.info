"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { Locale } from "@/lib/i18n/config";
import { translate, type Dictionary } from "@/lib/i18n/getDictionary";

type TranslationContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const TranslationContext = createContext<TranslationContextValue | null>(null);

type TranslationProviderProps = {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
};

export function TranslationProvider({
  locale,
  dictionary,
  children,
}: TranslationProviderProps) {
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(dictionary, key, params),
    [dictionary],
  );

  const value = useMemo(
    () => ({ locale, dictionary, t }),
    [locale, dictionary, t],
  );

  return createElement(TranslationContext.Provider, { value }, children);
}

/**
 * Reads translations for the active `[locale]` segment via React context.
 * Must be used under `TranslationProvider` (wired in `app/[locale]/layout.tsx`).
 */
export function useTranslation(): TranslationContextValue {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error(
      "useTranslation() must be used within a TranslationProvider",
    );
  }
  return context;
}
