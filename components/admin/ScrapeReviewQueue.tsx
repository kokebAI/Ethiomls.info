"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Filter,
  LoaderCircle,
  MessageSquare,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  formatPostedDate,
  isStalePosted,
  postedAgeParts,
} from "@/lib/datetime/posted-age";
import {
  groupScrapeReviewItems,
  type ScrapeReviewItem,
  type ScrapeReviewSourceGroup,
} from "@/lib/imports/scrape-review-groups";
import {
  DEFAULT_SCRAPE_REVIEW_FILTERS,
  filterScrapeReviewItems,
  filtersAreActive,
  scrapeReviewSourceOptions,
  type ScrapeReviewFilters,
} from "@/lib/imports/scrape-review-filters";
import { buildScrapeInviteMessageForListings } from "@/lib/imports/scrape-invite-message";
import { useTranslation } from "@/hooks/useTranslation";

export type { ScrapeReviewItem };

type ScrapeReviewQueueProps = {
  initialItems: ScrapeReviewItem[];
};

type BusyAction = "invite" | "audit" | "discard" | "save";

function isMissingPhone(phone: string | null | undefined): boolean {
  const raw = phone?.trim() ?? "";
  return !raw || raw.startsWith("telegram:@");
}

function missingFieldsFor(item: ScrapeReviewItem): string[] {
  const missing: string[] = [];
  if (isMissingPhone(item.contactPhone)) missing.push("phone");
  if (!(Number(item.priceAmount) > 1)) missing.push("price");
  if (!(item.titleEn?.trim() || item.titleAm?.trim())) missing.push("title");
  if (!item.addressLine?.trim()) missing.push("address");
  if (item.postedAtIsEstimated) missing.push("postedAt");
  return missing;
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ageLabel(
  postedAt: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const { value, unit } = postedAgeParts(postedAt);
  if (unit === "minutes") return t("scrapeReview.ageMinutes", { count: value });
  if (unit === "hours") return t("scrapeReview.ageHours", { count: value });
  if (unit === "days") return t("scrapeReview.ageDays", { count: value });
  return t("scrapeReview.ageWeeks", { count: value });
}

function PostedAgeLine({
  item,
  locale,
  t,
}: {
  item: ScrapeReviewItem;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const stale = isStalePosted(item.postedAt);
  const dateLabel = item.postedAtIsEstimated
    ? t("scrapeReview.importedLabel")
    : t("scrapeReview.postedOnSourceLabel");

  return (
    <p
      className={`mt-1.5 text-sm font-medium ${
        stale ? "text-amber-800" : "text-slate-700"
      }`}
    >
      <span className="text-slate-500">{dateLabel}: </span>
      {formatPostedDate(item.postedAt, locale)}
      {item.postedAtIsEstimated ? (
        <span className="ml-1 text-xs text-slate-500">
          ({t("scrapeReview.importedHint")})
        </span>
      ) : null}
      <span className="mx-1.5 text-slate-300" aria-hidden>
        ·
      </span>
      <span
        className={
          stale
            ? "rounded-full bg-amber-100 px-2 py-0.5 text-amber-900"
            : "text-slate-600"
        }
      >
        {t("scrapeReview.waitingFor", {
          age: ageLabel(item.postedAt, t),
        })}
      </span>
    </p>
  );
}

export function ScrapeReviewQueue({ initialItems }: ScrapeReviewQueueProps) {
  const { t, locale } = useTranslation();
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyPhoneKey, setBusyPhoneKey] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const [filters, setFilters] = useState<ScrapeReviewFilters>(
    DEFAULT_SCRAPE_REVIEW_FILTERS,
  );

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const sourceOptions = useMemo(
    () => scrapeReviewSourceOptions(items),
    [items],
  );

  const filteredItems = useMemo(
    () => filterScrapeReviewItems(items, filters),
    [items, filters],
  );

  const groups = useMemo(
    () =>
      groupScrapeReviewItems(filteredItems).map((sourceGroup) => ({
        ...sourceGroup,
        phoneGroups: sourceGroup.phoneGroups.map((phoneGroup) => ({
          ...phoneGroup,
          messagePreview: buildScrapeInviteMessageForListings(
            phoneGroup.listings,
          ),
        })),
      })),
    [filteredItems],
  );

  const activeFilters = filtersAreActive(filters);

  function patchFilter<K extends keyof ScrapeReviewFilters>(
    key: K,
    value: ScrapeReviewFilters[K],
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const removeItems = useCallback((ids: string[]) => {
    const drop = new Set(ids);
    setItems((prev) => prev.filter((item) => !drop.has(item.id)));
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<ScrapeReviewItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  async function saveFields(
    id: string,
    fields: Record<string, string | number | null>,
  ) {
    setBusyId(id);
    setBusyAction("save");
    setMessage(null);
    try {
      const response = await fetch("/api/scrape/update-fields", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id, ...fields }),
      });
      const payload = (await response.json()) as {
        message?: string;
        data?: Partial<ScrapeReviewItem> & { id: string };
      };
      if (!response.ok) {
        throw new Error(payload.message ?? t("scrapeReview.saveFailed"));
      }
      if (payload.data) {
        patchItem(id, {
          contactPhone: payload.data.contactPhone ?? null,
          contactName: payload.data.contactName ?? null,
          titleEn: payload.data.titleEn ?? null,
          titleAm: payload.data.titleAm ?? null,
          priceAmount: payload.data.priceAmount ?? "1",
          priceCurrency: payload.data.priceCurrency ?? "ETB",
          addressLine: payload.data.addressLine ?? null,
          bedrooms:
            typeof payload.data.bedrooms === "number"
              ? payload.data.bedrooms
              : null,
          listingType: payload.data.listingType ?? "SALE",
          sourcePostedAt: payload.data.sourcePostedAt ?? null,
          postedAt: payload.data.postedAt ?? new Date().toISOString(),
          postedAtIsEstimated: Boolean(payload.data.postedAtIsEstimated),
        });
      }
      setMessage({
        tone: "success",
        text: t("scrapeReview.saveDone", { id }),
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t("scrapeReview.saveFailed"),
      });
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function sendInviteGroup(
    phoneGroup: ScrapeReviewSourceGroup["phoneGroups"][number] & {
      messagePreview: string;
    },
  ) {
    if (!phoneGroup.phone?.trim()) {
      setMessage({
        tone: "error",
        text: t("scrapeReview.phoneMissing"),
      });
      return;
    }
    setBusyPhoneKey(phoneGroup.phoneKey);
    setBusyAction("invite");
    setMessage(null);
    try {
      const response = await fetch("/api/scrape/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: phoneGroup.listingIds }),
      });
      const payload = (await response.json()) as {
        message?: string;
        data?: {
          sentListingIds?: string[];
          accountCreated?: boolean;
          account?: { role?: string; label?: string } | null;
        };
      };
      if (!response.ok) {
        throw new Error(payload.message ?? t("scrapeReview.sendFailed"));
      }
      const sentIds = payload.data?.sentListingIds ?? phoneGroup.listingIds;
      removeItems(sentIds);
      const accountNote =
        payload.data?.account?.label && payload.data.account.role
          ? payload.data.accountCreated
            ? ` ${t("scrapeReview.accountCreated", {
                role: payload.data.account.role,
                label: payload.data.account.label,
              })}`
            : ` ${t("scrapeReview.accountLinked", {
                role: payload.data.account.role,
                label: payload.data.account.label,
              })}`
          : "";
      setMessage({
        tone: "success",
        text: `${t("scrapeReview.sendGroupDone", {
          count: sentIds.length,
          phone: phoneGroup.phone ?? "",
        })}${accountNote}`,
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t("scrapeReview.sendFailed"),
      });
    } finally {
      setBusyPhoneKey(null);
      setBusyAction(null);
    }
  }

  async function sendToPendingAudit(id: string) {
    setBusyId(id);
    setBusyAction("audit");
    setMessage(null);
    try {
      const response = await fetch("/api/scrape/send-to-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? t("scrapeReview.sendToAuditFailed"));
      }
      removeItems([id]);
      setMessage({
        tone: "success",
        text: t("scrapeReview.sendToAuditDone", { id }),
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t("scrapeReview.sendToAuditFailed"),
      });
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function discard(id: string) {
    setBusyId(id);
    setBusyAction("discard");
    setMessage(null);
    try {
      const response = await fetch("/api/scrape/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? t("scrapeReview.discardFailed"));
      }
      removeItems([id]);
      setMessage({
        tone: "success",
        text: t("scrapeReview.discardDone", { id }),
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t("scrapeReview.discardFailed"),
      });
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-sm text-ink-muted">{t("scrapeReview.empty")}</p>
        <Link
          href={`/${locale}/admin/imports`}
          className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline"
        >
          {t("scrapeReview.backToImports")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {message ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            message.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <section
        className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-[var(--shadow-card)] sm:p-5"
        aria-labelledby="scrape-review-filters-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="scrape-review-filters-heading"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-deep"
          >
            <Filter className="h-4 w-4 text-slate-500" aria-hidden />
            {t("scrapeReview.filterTitle")}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
            <span>
              {t("scrapeReview.filterShowing", {
                filtered: filteredItems.length,
                total: items.length,
              })}
            </span>
            {activeFilters ? (
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_SCRAPE_REVIEW_FILTERS)}
                className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t("scrapeReview.filterReset")}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2 lg:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              {t("scrapeReview.filterSearch")}
            </span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={filters.query}
                onChange={(e) => patchFilter("query", e.target.value)}
                placeholder={t("scrapeReview.filterSearchPlaceholder")}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-brand-500/30 focus:ring-2"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              {t("scrapeReview.filterSource")}
            </span>
            <select
              value={filters.sourceKey}
              onChange={(e) => patchFilter("sourceKey", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500/30 focus:ring-2"
            >
              <option value="all">{t("scrapeReview.filterAllSources")}</option>
              {sourceOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              {t("scrapeReview.filterListingType")}
            </span>
            <select
              value={filters.listingType}
              onChange={(e) => patchFilter("listingType", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500/30 focus:ring-2"
            >
              <option value="all">{t("scrapeReview.filterAllTypes")}</option>
              <option value="SALE">{t("scrapeReview.filterTypeSale")}</option>
              <option value="RENT">{t("scrapeReview.filterTypeRent")}</option>
              <option value="OFF_PLAN">
                {t("scrapeReview.filterTypeOffPlan")}
              </option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              {t("scrapeReview.filterDatePreset")}
            </span>
            <select
              value={filters.datePreset}
              onChange={(e) =>
                patchFilter(
                  "datePreset",
                  e.target.value as ScrapeReviewFilters["datePreset"],
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500/30 focus:ring-2"
            >
              <option value="any">{t("scrapeReview.filterDateAny")}</option>
              <option value="7d">{t("scrapeReview.filterDate7d")}</option>
              <option value="30d">{t("scrapeReview.filterDate30d")}</option>
              <option value="90d">{t("scrapeReview.filterDate90d")}</option>
              <option value="older90">
                {t("scrapeReview.filterDateOlder90")}
              </option>
              <option value="missingDate">
                {t("scrapeReview.filterDateMissing")}
              </option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              {t("scrapeReview.filterPostedFrom")}
            </span>
            <input
              type="date"
              value={filters.postedFrom}
              onChange={(e) => patchFilter("postedFrom", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500/30 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              {t("scrapeReview.filterPostedTo")}
            </span>
            <input
              type="date"
              value={filters.postedTo}
              onChange={(e) => patchFilter("postedTo", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500/30 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              {t("scrapeReview.filterMinPrice")}
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={filters.minPrice}
              onChange={(e) => patchFilter("minPrice", e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500/30 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              {t("scrapeReview.filterMaxPrice")}
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={filters.maxPrice}
              onChange={(e) => patchFilter("maxPrice", e.target.value)}
              placeholder="∞"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500/30 focus:ring-2"
            />
          </label>

          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              {t("scrapeReview.filterSort")}
            </span>
            <select
              value={filters.sort}
              onChange={(e) =>
                patchFilter("sort", e.target.value as ScrapeReviewFilters["sort"])
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500/30 focus:ring-2"
            >
              <option value="oldest">{t("scrapeReview.filterSortOldest")}</option>
              <option value="newest">{t("scrapeReview.filterSortNewest")}</option>
              <option value="priceAsc">
                {t("scrapeReview.filterSortPriceAsc")}
              </option>
              <option value="priceDesc">
                {t("scrapeReview.filterSortPriceDesc")}
              </option>
              <option value="source">
                {t("scrapeReview.filterSortSource")}
              </option>
            </select>
          </label>
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center text-sm text-ink-muted">
          <p>{t("scrapeReview.filterEmpty")}</p>
          {activeFilters ? (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_SCRAPE_REVIEW_FILTERS)}
              className="mt-3 font-semibold text-brand-700 hover:underline"
            >
              {t("scrapeReview.filterReset")}
            </button>
          ) : null}
        </div>
      ) : (
        groups.map((sourceGroup) => {
        const sourceStale = isStalePosted(sourceGroup.oldestPostedAt);
        return (
          <section key={sourceGroup.importSourceId ?? "manual"} className="space-y-4">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">
                  {t("scrapeReview.groupSource")}
                </h2>
                <p className="mt-1 text-lg font-semibold text-slate-deep">
                  {sourceGroup.label}
                </p>
                <p
                  className={`mt-1 text-sm ${
                    sourceStale ? "text-amber-800" : "text-slate-600"
                  }`}
                >
                  {t("scrapeReview.groupListingCount", {
                    count: sourceGroup.listingCount,
                  })}
                  {" · "}
                  {t("scrapeReview.waitingFor", {
                    age: ageLabel(sourceGroup.oldestPostedAt, t),
                  })}
                </p>
              </div>
            </header>

            {sourceGroup.phoneGroups.map((phoneGroup) => {
              const phoneBusy = busyPhoneKey === phoneGroup.phoneKey;
              const multiListing = phoneGroup.listings.length > 1;

              return (
                <div
                  key={phoneGroup.phoneKey}
                  className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        {t("scrapeReview.groupPhone")}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {phoneGroup.phone ?? t("scrapeReview.phoneMissing")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {t("scrapeReview.groupPhoneCount", {
                          count: phoneGroup.listings.length,
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={phoneBusy || !phoneGroup.phone}
                      onClick={() => void sendInviteGroup(phoneGroup)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-45"
                    >
                      {phoneBusy && busyAction === "invite" ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                      {phoneBusy && busyAction === "invite"
                        ? t("scrapeReview.sending")
                        : multiListing
                          ? t("scrapeReview.sendGroupInvite", {
                              count: phoneGroup.listings.length,
                            })
                          : t("scrapeReview.sendInvite")}
                    </button>
                  </div>

                  <details className="rounded-lg border border-amber-200/70 bg-amber-50/40 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-amber-900">
                      {t("scrapeReview.messagePreview")}
                    </summary>
                    <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-800">
                      {phoneGroup.messagePreview}
                    </pre>
                  </details>

                  <div className="grid gap-2">
                    {phoneGroup.listings.map((item) => {
                      const busy = busyId === item.id;
                      const missing = missingFieldsFor(item);
                      const priceValue =
                        Number(item.priceAmount) > 1
                          ? String(Math.round(Number(item.priceAmount)))
                          : "";

                      return (
                        <article
                          key={item.id}
                          className={`rounded-xl border bg-white px-3 py-2.5 shadow-sm ${
                            missing.length > 0
                              ? "border-amber-300/90"
                              : "border-slate-200/90"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[11px] font-semibold text-slate-500">
                                  {item.id}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                  {item.listingType}
                                </span>
                                {item.sourceUrl ? (
                                  <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-semibold text-brand-700 hover:underline"
                                  >
                                    {t("scrapeReview.sourceLink")}
                                  </a>
                                ) : null}
                              </div>
                              <p className="mt-0.5 truncate text-sm font-medium text-slate-900">
                                {item.titleEn ||
                                  item.titleAm ||
                                  t("scrapeReview.untitled")}
                              </p>
                              <PostedAgeLine item={item} locale={locale} t={t} />
                              {missing.length > 0 ? (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  <span className="text-[11px] font-semibold text-amber-800">
                                    {t("scrapeReview.missingFields")}:
                                  </span>
                                  {missing.map((field) => (
                                    <span
                                      key={field}
                                      className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
                                    >
                                      {field === "phone"
                                        ? t("scrapeReview.missingPhone")
                                        : field === "price"
                                          ? t("scrapeReview.missingPrice")
                                          : field === "title"
                                            ? t("scrapeReview.missingTitle")
                                            : field === "address"
                                              ? t("scrapeReview.missingAddress")
                                              : t("scrapeReview.missingPostedAt")}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Link
                                href={`/${locale}/listings/${item.id}`}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                {t("scrapeReview.edit")}
                              </Link>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void sendToPendingAudit(item.id)}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45"
                              >
                                {busy && busyAction === "audit" ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ClipboardCheck className="h-3.5 w-3.5" />
                                )}
                                {t("scrapeReview.sendToAudit")}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void discard(item.id)}
                                className="inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-45"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t("scrapeReview.discard")}
                              </button>
                            </div>
                          </div>

                          <form
                            key={[
                              item.id,
                              item.contactPhone,
                              item.titleEn,
                              item.priceAmount,
                              item.addressLine,
                              item.bedrooms,
                              item.listingType,
                              item.postedAt,
                            ].join("|")}
                            className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const form = new FormData(event.currentTarget);
                              const phone = String(form.get("contactPhone") ?? "").trim();
                              const titleEn = String(form.get("titleEn") ?? "").trim();
                              const priceRaw = String(form.get("priceAmount") ?? "").trim();
                              const addressLine = String(
                                form.get("addressLine") ?? "",
                              ).trim();
                              const bedroomsRaw = String(
                                form.get("bedrooms") ?? "",
                              ).trim();
                              const listingType = String(
                                form.get("listingType") ?? item.listingType,
                              );
                              const postedLocal = String(
                                form.get("sourcePostedAt") ?? "",
                              ).trim();
                              void saveFields(item.id, {
                                contactPhone: phone || null,
                                titleEn: titleEn || null,
                                priceAmount: priceRaw ? Number(priceRaw) : 1,
                                addressLine: addressLine || null,
                                bedrooms: bedroomsRaw ? Number(bedroomsRaw) : null,
                                listingType,
                                sourcePostedAt: postedLocal
                                  ? new Date(postedLocal).toISOString()
                                  : null,
                              });
                            }}
                          >
                            <label className="block">
                              <span
                                className={`mb-0.5 block text-[11px] font-semibold ${
                                  isMissingPhone(item.contactPhone)
                                    ? "text-amber-800"
                                    : "text-slate-500"
                                }`}
                              >
                                {t("scrapeReview.phone")}
                                {isMissingPhone(item.contactPhone)
                                  ? ` · ${t("scrapeReview.notFound")}`
                                  : ""}
                              </span>
                              <input
                                name="contactPhone"
                                defaultValue={
                                  isMissingPhone(item.contactPhone)
                                    ? ""
                                    : (item.contactPhone ?? "")
                                }
                                placeholder="09…"
                                className={`w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none ring-brand-500/20 focus:ring-2 ${
                                  isMissingPhone(item.contactPhone)
                                    ? "border-amber-300 bg-amber-50/50"
                                    : "border-slate-200 bg-white"
                                }`}
                              />
                            </label>

                            <label className="block">
                              <span
                                className={`mb-0.5 block text-[11px] font-semibold ${
                                  !(Number(item.priceAmount) > 1)
                                    ? "text-amber-800"
                                    : "text-slate-500"
                                }`}
                              >
                                {t("scrapeReview.price")}
                                {!(Number(item.priceAmount) > 1)
                                  ? ` · ${t("scrapeReview.notFound")}`
                                  : ""}
                              </span>
                              <input
                                name="priceAmount"
                                type="number"
                                min={0}
                                defaultValue={priceValue}
                                placeholder={t("scrapeReview.priceOnRequest")}
                                className={`w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none ring-brand-500/20 focus:ring-2 ${
                                  !(Number(item.priceAmount) > 1)
                                    ? "border-amber-300 bg-amber-50/50"
                                    : "border-slate-200 bg-white"
                                }`}
                              />
                            </label>

                            <label className="block">
                              <span className="mb-0.5 block text-[11px] font-semibold text-slate-500">
                                {t("scrapeReview.filterListingType")}
                              </span>
                              <select
                                name="listingType"
                                defaultValue={item.listingType}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none ring-brand-500/20 focus:ring-2"
                              >
                                <option value="SALE">
                                  {t("scrapeReview.filterTypeSale")}
                                </option>
                                <option value="RENT">
                                  {t("scrapeReview.filterTypeRent")}
                                </option>
                                <option value="OFF_PLAN">
                                  {t("scrapeReview.filterTypeOffPlan")}
                                </option>
                              </select>
                            </label>

                            <label className="block sm:col-span-2">
                              <span
                                className={`mb-0.5 block text-[11px] font-semibold ${
                                  !(item.titleEn?.trim() || item.titleAm?.trim())
                                    ? "text-amber-800"
                                    : "text-slate-500"
                                }`}
                              >
                                {t("scrapeReview.titleEn")}
                                {!(item.titleEn?.trim() || item.titleAm?.trim())
                                  ? ` · ${t("scrapeReview.notFound")}`
                                  : ""}
                              </span>
                              <input
                                name="titleEn"
                                defaultValue={item.titleEn ?? ""}
                                placeholder={t("scrapeReview.untitled")}
                                className={`w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none ring-brand-500/20 focus:ring-2 ${
                                  !(item.titleEn?.trim() || item.titleAm?.trim())
                                    ? "border-amber-300 bg-amber-50/50"
                                    : "border-slate-200 bg-white"
                                }`}
                              />
                            </label>

                            <label className="block">
                              <span className="mb-0.5 block text-[11px] font-semibold text-slate-500">
                                {t("scrapeReview.beds")}
                              </span>
                              <input
                                name="bedrooms"
                                type="number"
                                min={0}
                                defaultValue={item.bedrooms ?? ""}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none ring-brand-500/20 focus:ring-2"
                              />
                            </label>

                            <label className="block sm:col-span-2">
                              <span
                                className={`mb-0.5 block text-[11px] font-semibold ${
                                  !item.addressLine?.trim()
                                    ? "text-amber-800"
                                    : "text-slate-500"
                                }`}
                              >
                                {t("scrapeReview.address")}
                                {!item.addressLine?.trim()
                                  ? ` · ${t("scrapeReview.notFound")}`
                                  : ""}
                              </span>
                              <input
                                name="addressLine"
                                defaultValue={item.addressLine ?? ""}
                                className={`w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none ring-brand-500/20 focus:ring-2 ${
                                  !item.addressLine?.trim()
                                    ? "border-amber-300 bg-amber-50/50"
                                    : "border-slate-200 bg-white"
                                }`}
                              />
                            </label>

                            <label className="block">
                              <span
                                className={`mb-0.5 block text-[11px] font-semibold ${
                                  item.postedAtIsEstimated
                                    ? "text-amber-800"
                                    : "text-slate-500"
                                }`}
                              >
                                {t("scrapeReview.postedOnSourceLabel")}
                                {item.postedAtIsEstimated
                                  ? ` · ${t("scrapeReview.notFound")}`
                                  : ""}
                              </span>
                              <input
                                name="sourcePostedAt"
                                type="datetime-local"
                                defaultValue={toDatetimeLocalValue(item.postedAt)}
                                className={`w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none ring-brand-500/20 focus:ring-2 ${
                                  item.postedAtIsEstimated
                                    ? "border-amber-300 bg-amber-50/50"
                                    : "border-slate-200 bg-white"
                                }`}
                              />
                            </label>

                            <div className="flex items-end sm:col-span-2 lg:col-span-1">
                              <button
                                type="submit"
                                disabled={busy}
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-45"
                              >
                                {busy && busyAction === "save" ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                {busy && busyAction === "save"
                                  ? t("scrapeReview.saving")
                                  : t("scrapeReview.saveFields")}
                              </button>
                            </div>
                          </form>

                          <details className="mt-2">
                            <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">
                              {t("scrapeReview.rawLabel")}
                            </summary>
                            <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs leading-relaxed text-slate-700">
                              {item.scrapedRawText?.trim() ||
                                t("scrapeReview.noRaw")}
                            </pre>
                          </details>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })
      )}
    </div>
  );
}
