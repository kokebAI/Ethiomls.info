"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  LoaderCircle,
  MessageSquare,
  Pencil,
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
import { buildScrapeInviteMessageForListings } from "@/lib/imports/scrape-invite-message";
import { useTranslation } from "@/hooks/useTranslation";

export type { ScrapeReviewItem };

type ScrapeReviewQueueProps = {
  initialItems: ScrapeReviewItem[];
};

type BusyAction = "invite" | "audit" | "discard";

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

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const groups = useMemo(
    () =>
      groupScrapeReviewItems(items).map((sourceGroup) => ({
        ...sourceGroup,
        phoneGroups: sourceGroup.phoneGroups.map((phoneGroup) => ({
          ...phoneGroup,
          messagePreview: buildScrapeInviteMessageForListings(
            phoneGroup.listings,
          ),
        })),
      })),
    [items],
  );

  const removeItems = useCallback((ids: string[]) => {
    const drop = new Set(ids);
    setItems((prev) => prev.filter((item) => !drop.has(item.id)));
  }, []);

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

      <p className="text-sm text-ink-muted">
        {t("scrapeReview.queueCount", { count: items.length })}
        {" · "}
        {t("scrapeReview.sortedOldestFirst")}
      </p>

      {groups.map((sourceGroup) => {
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
                  className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4"
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

                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-xs leading-relaxed text-slate-900">
                    {phoneGroup.messagePreview}
                  </pre>

                  <div className="grid gap-4">
                    {phoneGroup.listings.map((item) => {
                      const busy = busyId === item.id;
                      const price =
                        Number(item.priceAmount) > 1
                          ? `${Math.round(Number(item.priceAmount)).toLocaleString("en-US")} ${item.priceCurrency}`
                          : t("scrapeReview.priceOnRequest");

                      return (
                        <article
                          key={item.id}
                          className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 shadow-[var(--shadow-card)]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-semibold tracking-wide text-slate-500">
                                {item.id}
                              </p>
                              {item.sourceUrl ? (
                                <p className="mt-0.5 truncate text-sm text-ink-muted">
                                  <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-brand-700 hover:underline"
                                  >
                                    {t("scrapeReview.sourceLink")}
                                  </a>
                                </p>
                              ) : null}
              <PostedAgeLine item={item} locale={locale} t={t} />
                              {item.postedAtIsEstimated ? (
                                <p className="mt-1 text-xs font-semibold text-red-700">
                                  {t("scrapeReview.missingPostDate")}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/${locale}/listings/${item.id}`}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50"
                              >
                                <Pencil className="h-4 w-4" />
                                {t("scrapeReview.edit")}
                              </Link>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void sendToPendingAudit(item.id)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-45"
                              >
                                {busy && busyAction === "audit" ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ClipboardCheck className="h-4 w-4" />
                                )}
                                {t("scrapeReview.sendToAudit")}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void discard(item.id)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-45"
                              >
                                <Trash2 className="h-4 w-4" />
                                {t("scrapeReview.discard")}
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-0 lg:grid-cols-2">
                            <section className="border-b border-slate-100 p-4 sm:p-5 lg:border-b-0 lg:border-r">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                {t("scrapeReview.rawLabel")}
                              </h4>
                              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
                                {item.scrapedRawText?.trim() ||
                                  t("scrapeReview.noRaw")}
                              </pre>
                            </section>

                            <section className="p-4 sm:p-5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                {t("scrapeReview.structuredLabel")}
                              </h4>
                              <dl className="mt-3 grid gap-2.5 text-sm">
                                <div>
                                  <dt className="text-xs font-semibold text-slate-500">
                                    {t("scrapeReview.titleEn")}
                                  </dt>
                                  <dd className="font-medium text-slate-900">
                                    {item.titleEn || "—"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-xs font-semibold text-slate-500">
                                    {t("scrapeReview.titleAm")}
                                  </dt>
                                  <dd className="font-medium text-slate-900">
                                    {item.titleAm || "—"}
                                  </dd>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <dt className="text-xs font-semibold text-slate-500">
                                      {t("scrapeReview.price")}
                                    </dt>
                                    <dd className="font-medium tabular-nums text-slate-900">
                                      {price}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs font-semibold text-slate-500">
                                      {t("scrapeReview.phone")}
                                    </dt>
                                    <dd className="font-medium tabular-nums text-slate-900">
                                      {item.contactPhone || "—"}
                                    </dd>
                                  </div>
                                </div>
                                {(item.bedrooms != null || item.addressLine) && (
                                  <div>
                                    <dt className="text-xs font-semibold text-slate-500">
                                      {t("scrapeReview.details")}
                                    </dt>
                                    <dd className="text-slate-800">
                                      {[
                                        item.bedrooms != null
                                          ? `${item.bedrooms} ${t("scrapeReview.beds")}`
                                          : null,
                                        item.listingType,
                                        item.addressLine,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </dd>
                                  </div>
                                )}
                              </dl>

                              <Link
                                href={`/${locale}/listings/${item.id}`}
                                className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline"
                              >
                                {t("scrapeReview.openListing")}
                              </Link>
                            </section>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
