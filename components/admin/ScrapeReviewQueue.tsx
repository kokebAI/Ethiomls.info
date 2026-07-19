"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, Trash2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export type ScrapeReviewItem = {
  id: string;
  scrapedRawText: string | null;
  titleEn: string | null;
  titleAm: string | null;
  descriptionEn: string | null;
  descriptionAm: string | null;
  contactPhone: string | null;
  priceAmount: string;
  priceCurrency: string;
  listingType: string;
  bedrooms: number | null;
  addressLine: string | null;
  sourceUrl: string | null;
  messagePreview: string;
  importSourceLabel: string | null;
  createdAt: string;
};

type ScrapeReviewQueueProps = {
  initialItems: ScrapeReviewItem[];
};

export function ScrapeReviewQueue({ initialItems }: ScrapeReviewQueueProps) {
  const { t, locale } = useTranslation();
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);


  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  async function sendInvite(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      const response = await fetch("/api/scrape/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id }),
      });
      const payload = (await response.json()) as {
        message?: string;
        data?: {
          notificationStatus?: string;
          accountCreated?: boolean;
          account?: { label?: string; role?: string; phone?: string | null };
        };
      };
      if (!response.ok) {
        throw new Error(payload.message ?? t("scrapeReview.sendFailed"));
      }
      removeItem(id);
      const account = payload.data?.account;
      const createdHint = payload.data?.accountCreated
        ? t("scrapeReview.accountCreated", {
            label: account?.label ?? "",
            role: account?.role ?? "",
          })
        : account
          ? t("scrapeReview.accountLinked", {
              label: account.label ?? "",
              role: account.role ?? "",
            })
          : "";
      setMessage({
        tone: "success",
        text: [t("scrapeReview.sendDone", { id }), createdHint]
          .filter(Boolean)
          .join(" "),
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
      setBusyId(null);
    }
  }

  async function discard(id: string) {
    setBusyId(id);
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
      removeItem(id);
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
    <div className="grid gap-5">
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
      </p>

      {items.map((item) => {
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
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {item.importSourceLabel ?? t("scrapeReview.unknownSource")}
                  {item.sourceUrl ? (
                    <>
                      {" · "}
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-700 hover:underline"
                      >
                        {t("scrapeReview.sourceLink")}
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendInvite(item.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-45"
                >
                  {busy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {t("scrapeReview.editSend")}
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t("scrapeReview.rawLabel")}
                </h3>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
                  {item.scrapedRawText?.trim() || t("scrapeReview.noRaw")}
                </pre>
              </section>

              <section className="p-4 sm:p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t("scrapeReview.structuredLabel")}
                </h3>
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

                <h4 className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t("scrapeReview.messagePreview")}
                </h4>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-sm leading-relaxed text-slate-900">
                  {item.messagePreview}
                </pre>

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
  );
}
