"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type ScrapeRunSummary = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  postsSeen: number;
  listingsCreated: number;
  listingsUpdated: number;
  listingsSkipped: number;
  errorMessage: string | null;
};

type ImportSourceRow = {
  id: string;
  label: string;
  sourceType: "TELEGRAM" | "WEBSITE" | "FACEBOOK";
  url: string;
  normalizedUrl: string;
  telegramHandle: string | null;
  isActive: boolean;
  notes: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  runs: ScrapeRunSummary[];
  _count: { listings: number };
};

async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  const raw = await response.text();
  try {
    const payload = JSON.parse(raw) as { message?: string; error?: string };
    if (payload.message) return payload.message;
    if (payload.error) return payload.error;
  } catch {
    // Non-JSON (often a platform timeout HTML page)
  }
  if (response.status === 504 || response.status === 502) {
    return "Scrape timed out before finishing. The run will be marked failed — try again.";
  }
  if (raw.trim().startsWith("<")) {
    return "Server returned an HTML error (often a timeout). Try again in a moment.";
  }
  return fallback;
}

export function ImportSourcesPanel() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<ImportSourceRow[]>([]);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/import-sources");
      if (!response.ok) {
        throw new Error(await readApiError(response, t("imports.loadFailed")));
      }
      const payload = (await response.json()) as {
        data?: ImportSourceRow[];
      };
      setSources(payload.data ?? []);
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : t("imports.loadFailed"),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  async function addSource(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/import-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          label: label.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, t("imports.saveFailed")));
      }
      const payload = (await response.json()) as {
        data?: ImportSourceRow;
        warning?: string | null;
      };
      setUrl("");
      setLabel("");
      setNotes("");
      setMessage({
        tone: payload.warning ? "warning" : "success",
        text: payload.warning
          ? payload.warning
          : t("imports.saved"),
      });
      await loadSources();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : t("imports.saveFailed"),
      });
    } finally {
      setSaving(false);
    }
  }

  async function runSource(id: string) {
    setRunningId(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/import-sources/${id}/run`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, t("imports.runFailed")));
      }
      const payload = (await response.json()) as {
        data?: ScrapeRunSummary;
      };
      const run = payload.data;
      const created = run?.listingsCreated ?? 0;
      const updated = run?.listingsUpdated ?? 0;
      const skipped = run?.listingsSkipped ?? 0;
      if (run?.status === "FAILED" || (created === 0 && updated === 0 && run?.errorMessage)) {
        setMessage({
          tone: "error",
          text: run.errorMessage || t("imports.runFailed"),
        });
      } else if (created === 0 && updated === 0) {
        setMessage({
          tone: "warning",
          text: t("imports.runEmpty", { skipped }),
        });
      } else {
        setMessage({
          tone: "success",
          text: t("imports.runDone", {
            created,
            updated,
            skipped,
          }),
        });
      }
      await loadSources();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : t("imports.runFailed"),
      });
      await loadSources();
    } finally {
      setRunningId(null);
    }
  }

  async function deleteSource(source: ImportSourceRow) {
    const confirmed = window.confirm(
      t("imports.deleteConfirm", {
        label: source.label,
        count: source._count.listings,
      }),
    );
    if (!confirmed) return;

    setDeletingId(source.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/import-sources/${source.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(
          await readApiError(response, t("imports.deleteFailed")),
        );
      }
      const payload = (await response.json()) as {
        data?: { listingsDeleted?: number };
      };
      setMessage({
        tone: "success",
        text: t("imports.deleteDone", {
          label: source.label,
          count: payload.data?.listingsDeleted ?? source._count.listings,
        }),
      });
      await loadSources();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : t("imports.deleteFailed"),
      });
    } finally {
      setDeletingId(null);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15";

  return (
    <div className="grid gap-6">
      <form
        onSubmit={addSource}
        className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[var(--shadow-card)] sm:p-6"
      >
        <h2 className="text-lg font-semibold text-slate-deep">
          {t("imports.addTitle")}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{t("imports.addLede")}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              {t("imports.url")}
            </span>
            <input
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={fieldClass}
              placeholder={t("imports.urlPlaceholder")}
            />
          </label>
          <label>
            <span className="text-sm font-semibold text-slate-700">
              {t("imports.label")}
            </span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className={fieldClass}
              placeholder={t("imports.labelPlaceholder")}
            />
          </label>
          <label>
            <span className="text-sm font-semibold text-slate-700">
              {t("imports.notes")}
            </span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={fieldClass}
              placeholder={t("imports.notesPlaceholder")}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving || url.trim().length < 3}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-45"
        >
          {saving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {saving ? t("common.loading") : t("imports.addCta")}
        </button>
      </form>

      {message ? (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            message.tone === "success"
              ? "bg-emerald-50 text-emerald-800"
              : message.tone === "warning"
                ? "bg-amber-50 text-amber-900"
                : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-deep">
            {t("imports.sourcesTitle")}
          </h2>
          <button
            type="button"
            onClick={() => void loadSources()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("imports.refresh")}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">{t("imports.cliHint")}</p>

        {loading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {t("common.loading")}
          </p>
        ) : sources.length === 0 ? (
          <p className="mt-6 text-sm text-ink-muted">{t("imports.empty")}</p>
        ) : (
          <ul className="mt-5 grid gap-3">
            {sources.map((source) => {
              const lastRun = source.runs[0];
              const isCorridorOffPlan =
                /corridor-offplan|east-offplan/i.test(source.notes ?? "");
              const busy =
                runningId === source.id || deletingId === source.id;
              return (
                <li
                  key={source.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-slate-deep">
                        {source.label}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        <span className="mr-2 rounded-full bg-slate-900 px-2 py-0.5 font-bold uppercase tracking-wide text-amber-300">
                          {source.sourceType === "TELEGRAM"
                            ? t("imports.typeTelegram")
                            : source.sourceType === "FACEBOOK"
                              ? t("imports.typeFacebook")
                              : t("imports.typeWebsite")}
                        </span>
                        {isCorridorOffPlan ? (
                          <span className="mr-2 rounded-full bg-emerald-800 px-2 py-0.5 font-bold uppercase tracking-wide text-emerald-100">
                            {t("imports.corridorOffPlanBadge")}
                          </span>
                        ) : null}
                        {source.normalizedUrl}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {t("imports.listingCount", {
                          count: source._count.listings,
                        })}
                        {lastRun
                          ? ` · ${t("imports.lastRun", {
                              status: lastRun.status,
                              created: lastRun.listingsCreated,
                              updated: lastRun.listingsUpdated,
                            })}`
                          : ""}
                      </p>
                      {lastRun?.errorMessage ? (
                        <p className="text-xs text-red-600">
                          {lastRun.errorMessage}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || !source.isActive}
                        onClick={() => void runSource(source.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-45"
                      >
                        {runningId === source.id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : null}
                        {runningId === source.id
                          ? t("imports.running")
                          : t("imports.runCta")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deleteSource(source)}
                        className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-45"
                      >
                        {deletingId === source.id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {deletingId === source.id
                          ? t("imports.deleting")
                          : t("imports.deleteCta")}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
