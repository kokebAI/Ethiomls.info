export const locales = ["en", "am", "om", "ti"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "am";

export const localeLabels: Record<
  Locale,
  { native: string; english: string; short: string }
> = {
  en: { native: "English", english: "English", short: "EN" },
  am: { native: "አማርኛ", english: "Amharic", short: "አማ" },
  om: { native: "Afaan Oromoo", english: "Oromiffa", short: "OM" },
  ti: { native: "ትግርኛ", english: "Tigrigna", short: "ትግ" },
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
