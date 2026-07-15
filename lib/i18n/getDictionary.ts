import type { Locale } from "@/lib/i18n/config";
import en from "@/locales/en/common.json";
import am from "@/locales/am/common.json";
import om from "@/locales/om/common.json";
import ti from "@/locales/ti/common.json";

export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  en,
  am,
  om,
  ti,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

/** Resolve nested keys like `listing.subCity` from a dictionary. */
export function translate(
  dictionary: Dictionary,
  key: string,
  params?: Record<string, string | number>,
): string {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionary);

  if (typeof value !== "string") {
    return key;
  }

  if (!params) return value;

  return Object.entries(params).reduce(
    (text, [name, replacement]) =>
      text.replaceAll(`{${name}}`, String(replacement)),
    value,
  );
}
