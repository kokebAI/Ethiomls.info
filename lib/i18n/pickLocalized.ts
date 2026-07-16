import type { Prisma } from "@prisma/client";
import type { Locale } from "@/lib/i18n/config";

type LocalizedJson = Prisma.JsonValue;

/** Pick a localized string from `{ en, am, om, ti }` JSON, with sensible fallbacks. */
export function pickLocalized(
  value: LocalizedJson | null | undefined,
  locale: Locale,
): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const record = value as Record<string, unknown>;
  const preferred = record[locale];
  if (typeof preferred === "string" && preferred.trim()) {
    return preferred;
  }

  for (const fallback of ["en", "am", "om", "ti"]) {
    const candidate = record[fallback];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return "";
}
