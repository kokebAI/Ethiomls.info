"use client";

import { useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Keeps `<html lang>` in sync with the active `[locale]` route.
 * Root layout defaults to `en`; this updates on every locale change.
 */
export function DocumentLocale() {
  const { locale } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  return null;
}
