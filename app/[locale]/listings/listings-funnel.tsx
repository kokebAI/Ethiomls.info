"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { PageDirectory, type DirectoryItem } from "@/components/PageDirectory";
import { useTranslation } from "@/hooks/useTranslation";
import {
  convertBudget,
  resolveNbeUsdEtbRate,
} from "@/lib/compliance/currency";

export type ListingFilterItem = DirectoryItem & {
  subCityCode: string;
  listingType: string;
  priceAmount: number;
  priceCurrency: "ETB" | "USD";
  completionPercent: number | null;
};

type SubCityOption = {
  code: string;
  label: string;
};

type ListingsFunnelProps = {
  listings: ListingFilterItem[];
  subCities: SubCityOption[];
  emptyMessage: string;
};

const LISTING_TYPES = ["SALE", "RENT", "OFF_PLAN"] as const;

function listingTypeLabel(type: string, t: (key: string) => string): string {
  switch (type) {
    case "SALE":
      return t("listing.forSale");
    case "RENT":
      return t("listing.forRent");
    case "OFF_PLAN":
      return t("listing.offPlan");
    default:
      return type.replaceAll("_", " ");
  }
}

export function ListingsFunnel({
  listings,
  subCities,
  emptyMessage,
}: ListingsFunnelProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  // Seed filters from URL params sent by the home-page search guide.
  const initialType = searchParams.get("type") ?? "";
  const initialMax = searchParams.get("max") ?? "";
  const initialMinCompletion = searchParams.get("minCompletion") ?? "";
  const initialClusterSubCities = (searchParams.get("subCities") ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [subCityCode, setSubCityCode] = useState("");
  const [clusterSubCities, setClusterSubCities] = useState<string[]>(
    initialClusterSubCities,
  );
  const [listingType, setListingType] = useState(
    (LISTING_TYPES as readonly string[]).includes(initialType)
      ? initialType
      : "",
  );
  const [minCompletion, setMinCompletion] = useState(
    /^\d{1,3}$/.test(initialMinCompletion) ? initialMinCompletion : "",
  );
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState(
    /^\d+$/.test(initialMax) ? initialMax : "",
  );
  const [sortBy, setSortBy] = useState<"newest" | "price-asc" | "price-desc">(
    "newest",
  );

  // Guided search and filter inputs are ETB; normalize listing prices before compare/sort.
  const rate = useMemo(() => resolveNbeUsdEtbRate(), []);

  const filtered = useMemo(() => {
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    const toEtb = (item: ListingFilterItem) =>
      convertBudget(item.priceAmount, item.priceCurrency, "ETB", rate);

    let result = listings.filter((item) => {
      if (subCityCode && item.subCityCode !== subCityCode) return false;
      if (
        !subCityCode &&
        clusterSubCities.length > 0 &&
        !clusterSubCities.includes(item.subCityCode)
      ) {
        return false;
      }
      if (listingType && item.listingType !== listingType) return false;
      const minComplete = minCompletion ? Number(minCompletion) : null;
      if (
        minComplete != null &&
        Number.isFinite(minComplete) &&
        minComplete > 0
      ) {
        const pct = item.completionPercent ?? 0;
        if (pct < minComplete) return false;
      }
      const etb = toEtb(item);
      if (min != null && Number.isFinite(min) && etb < min) {
        return false;
      }
      if (max != null && Number.isFinite(max) && etb > max) {
        return false;
      }
      return true;
    });

    result = [...result];
    if (sortBy === "price-asc") {
      result.sort((a, b) => toEtb(a) - toEtb(b));
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => toEtb(b) - toEtb(a));
    }

    return result;
  }, [
    listings,
    subCityCode,
    clusterSubCities,
    listingType,
    minCompletion,
    minPrice,
    maxPrice,
    sortBy,
    rate,
  ]);

  function resetFilters() {
    setSubCityCode("");
    setClusterSubCities([]);
    setListingType("");
    setMinCompletion("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("newest");
  }

  const hasActiveFilters =
    Boolean(
      subCityCode ||
        clusterSubCities.length > 0 ||
        listingType ||
        minCompletion ||
        minPrice ||
        maxPrice,
    ) || sortBy !== "newest";

  const filterPanel = (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {t("filters.title")}
        </h2>
        {hasActiveFilters ? (
          <button
            type="button"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            onClick={resetFilters}
          >
            {t("filters.reset")}
          </button>
        ) : null}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">
          {t("listing.subCity")}
        </span>
        <select
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          value={subCityCode}
          onChange={(event) => setSubCityCode(event.target.value)}
        >
          <option value="">{t("filters.allAreas")}</option>
          {subCities.map((city) => (
            <option key={city.code} value={city.code}>
              {city.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">
          {t("listing.listingType")}
        </span>
        <select
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          value={listingType}
          onChange={(event) => setListingType(event.target.value)}
        >
          <option value="">{t("filters.allTypes")}</option>
          {LISTING_TYPES.map((type) => (
            <option key={type} value={type}>
              {listingTypeLabel(type, t)}
            </option>
          ))}
        </select>
      </label>

      {(listingType === "OFF_PLAN" || minCompletion) && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">
            {t("filters.minCompletion")}
          </span>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            value={minCompletion}
            onChange={(event) => setMinCompletion(event.target.value)}
          >
            <option value="">{t("search.completion.any")}</option>
            <option value="25">{t("search.completion.from25")}</option>
            <option value="50">{t("search.completion.from50")}</option>
            <option value="80">{t("search.completion.from80")}</option>
            <option value="100">{t("search.completion.complete")}</option>
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">
            {t("filters.minPrice")}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">
            {t("filters.maxPrice")}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="∞"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">
          {t("filters.sortBy")}
        </span>
        <select
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          value={sortBy}
          onChange={(event) =>
            setSortBy(event.target.value as typeof sortBy)
          }
        >
          <option value="newest">{t("filters.newest")}</option>
          <option value="price-asc">{t("filters.priceLowHigh")}</option>
          <option value="price-desc">{t("filters.priceHighLow")}</option>
        </select>
      </label>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="hidden w-full shrink-0 lg:block lg:w-72 xl:w-80">
          <div className="sticky top-[5.5rem] rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]">
            {filterPanel}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600" role="status">
              {t("filters.showingCount", {
                filtered: String(filtered.length),
                total: String(listings.length),
              })}
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
              onClick={() => setMobileFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("filters.title")}
            </button>
          </div>

          {mobileFiltersOpen ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)] lg:hidden">
              {filterPanel}
            </div>
          ) : null}

          <PageDirectory
            items={filtered}
            emptyMessage={emptyMessage}
            layout="grid"
          />
        </div>
      </div>
    </div>
  );
}
