"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Plus, RefreshCw } from "lucide-react";
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
  sourceType: "TELEGRAM" | "WEBSITE";
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

export function ImportSourcesPanel() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<ImportSourceRow[]>([]);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/import-sources");
      const payload = (await response.json()) as {
        data?: ImportSourceRow[];
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? t("imports.loadFailed"));
      }
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
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? t("imports.saveFailed"));
      }
      setUrl("");
      setLabel("");
      setNotes("");
      setMessage({ tone: "success", text: t("imports.saved") });
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
      const payload = (await response.json()) as {
        data?: ScrapeRunSummary;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? t("imports.runFailed"));
      }
      const run = payload.data;
      setMessage({
        tone: "success",
        text: t("imports.runDone", {
          created: run?.listingsCreated ?? 0,
          updated: run?.listingsUpdated ?? 0,
          skipped: run?.listingsSkipped ?? 0,
        }),
      });
      await loadSources();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : t("imports.runFailed"),
      });
    } finally {
      setRunningId(null);
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
                            : t("imports.typeWebsite")}
                        </span>
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
                    <button
                      type="button"
                      disabled={runningId === source.id || !source.isActive}
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
