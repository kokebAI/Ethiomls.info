/**
 * Relative age helpers for scrape / import review UI.
 */

export type PostedAgeUnit = "minutes" | "hours" | "days" | "weeks";

export function postedAgeParts(
  isoOrDate: string | Date,
  now: Date = new Date(),
): { value: number; unit: PostedAgeUnit; totalMs: number } {
  const then =
    typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const totalMs = Math.max(0, now.getTime() - then.getTime());
  const minutes = Math.floor(totalMs / 60_000);
  if (minutes < 60) {
    return { value: Math.max(1, minutes || 0), unit: "minutes", totalMs };
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return { value: hours, unit: "hours", totalMs };
  }
  const days = Math.floor(hours / 24);
  if (days < 14) {
    return { value: days, unit: "days", totalMs };
  }
  return { value: Math.floor(days / 7), unit: "weeks", totalMs };
}

export function formatPostedDate(
  isoOrDate: string | Date,
  locale: string,
): string {
  const date =
    typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** True when a scrape has been waiting longer than a week. */
export function isStalePosted(isoOrDate: string | Date, now = new Date()) {
  return postedAgeParts(isoOrDate, now).totalMs >= 7 * 24 * 60 * 60 * 1000;
}
