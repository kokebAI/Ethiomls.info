import type { ScrapeReviewItem } from "@/lib/imports/scrape-review-groups";

export type ScrapeReviewDatePreset =
  | "any"
  | "7d"
  | "30d"
  | "90d"
  | "older90"
  | "missingDate";

export type ScrapeReviewSort =
  | "oldest"
  | "newest"
  | "priceAsc"
  | "priceDesc"
  | "source";

export type ScrapeReviewFilters = {
  query: string;
  sourceKey: string; // "all" | importSourceId | "manual"
  listingType: string; // "all" | SALE | RENT | OFF_PLAN
  datePreset: ScrapeReviewDatePreset;
  postedFrom: string; // yyyy-mm-dd
  postedTo: string;
  minPrice: string;
  maxPrice: string;
  sort: ScrapeReviewSort;
};

export const DEFAULT_SCRAPE_REVIEW_FILTERS: ScrapeReviewFilters = {
  query: "",
  sourceKey: "all",
  listingType: "all",
  datePreset: "any",
  postedFrom: "",
  postedTo: "",
  minPrice: "",
  maxPrice: "",
  sort: "oldest",
};

function startOfDayMs(isoDate: string): number | null {
  if (!isoDate.trim()) return null;
  const d = new Date(`${isoDate.trim()}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function endOfDayMs(isoDate: string): number | null {
  if (!isoDate.trim()) return null;
  const d = new Date(`${isoDate.trim()}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export function scrapeReviewSourceOptions(items: ScrapeReviewItem[]): Array<{
  key: string;
  label: string;
  count: number;
}> {
  const map = new Map<string, { label: string; count: number }>();
  for (const item of items) {
    const key = item.importSourceId ?? "manual";
    const label =
      item.importSourceLabel?.trim() ||
      item.contactName?.trim() ||
      "Manual / unknown source";
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { label, count: 1 });
  }
  return [...map.entries()]
    .map(([key, value]) => ({ key, label: value.label, count: value.count }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export function filtersAreActive(filters: ScrapeReviewFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.sourceKey !== "all" ||
    filters.listingType !== "all" ||
    filters.datePreset !== "any" ||
    filters.postedFrom !== "" ||
    filters.postedTo !== "" ||
    filters.minPrice !== "" ||
    filters.maxPrice !== "" ||
    filters.sort !== "oldest"
  );
}

export function filterScrapeReviewItems(
  items: ScrapeReviewItem[],
  filters: ScrapeReviewFilters,
  now = new Date(),
): ScrapeReviewItem[] {
  const q = filters.query.trim().toLowerCase();
  const minPrice = Number(filters.minPrice);
  const maxPrice = Number(filters.maxPrice);
  const hasMin = Number.isFinite(minPrice) && filters.minPrice.trim() !== "";
  const hasMax = Number.isFinite(maxPrice) && filters.maxPrice.trim() !== "";
  const fromMs = startOfDayMs(filters.postedFrom);
  const toMs = endOfDayMs(filters.postedTo);
  const nowMs = now.getTime();

  let filtered = items.filter((item) => {
    if (filters.sourceKey !== "all") {
      const key = item.importSourceId ?? "manual";
      if (key !== filters.sourceKey) return false;
    }

    if (filters.listingType !== "all" && item.listingType !== filters.listingType) {
      return false;
    }

    if (filters.datePreset === "missingDate") {
      if (!item.postedAtIsEstimated) return false;
    } else if (filters.datePreset !== "any") {
      const ageMs = Math.max(0, nowMs - new Date(item.postedAt).getTime());
      const day = 24 * 60 * 60 * 1000;
      if (filters.datePreset === "7d" && ageMs > 7 * day) return false;
      if (filters.datePreset === "30d" && ageMs > 30 * day) return false;
      if (filters.datePreset === "90d" && ageMs > 90 * day) return false;
      if (filters.datePreset === "older90" && ageMs <= 90 * day) return false;
    }

    const postedMs = new Date(item.postedAt).getTime();
    if (fromMs != null && postedMs < fromMs) return false;
    if (toMs != null && postedMs > toMs) return false;

    const price = Number(item.priceAmount);
    if (hasMin && !(Number.isFinite(price) && price >= minPrice)) return false;
    if (hasMax && !(Number.isFinite(price) && price <= maxPrice && price > 1)) {
      return false;
    }

    if (q) {
      const haystack = [
        item.id,
        item.titleEn,
        item.titleAm,
        item.contactPhone,
        item.contactName,
        item.importSourceLabel,
        item.addressLine,
        item.listingType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case "newest":
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      case "priceAsc":
        return Number(a.priceAmount) - Number(b.priceAmount);
      case "priceDesc":
        return Number(b.priceAmount) - Number(a.priceAmount);
      case "source": {
        const la =
          a.importSourceLabel?.trim() || a.contactName?.trim() || "Manual";
        const lb =
          b.importSourceLabel?.trim() || b.contactName?.trim() || "Manual";
        const bySource = la.localeCompare(lb, undefined, { sensitivity: "base" });
        if (bySource !== 0) return bySource;
        return new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime();
      }
      case "oldest":
      default:
        return new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime();
    }
  });

  return filtered;
}
