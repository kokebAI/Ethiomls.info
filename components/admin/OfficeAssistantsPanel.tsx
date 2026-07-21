"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Plus, UserMinus, UserPlus } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type AssistantRow = {
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
};

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    if (payload.message) return payload.message;
    if (payload.error) return payload.error;
  } catch {
    // ignore
  }
  return fallback;
}

export function OfficeAssistantsPanel() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AssistantRow[]>([]);
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/office-assistants");
      if (!response.ok) {
        throw new Error(
          await readApiError(response, t("officeAssistants.loadFailed")),
        );
      }
      const payload = (await response.json()) as { data?: AssistantRow[] };
      setRows(payload.data ?? []);
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t("officeAssistants.loadFailed"),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addAssistant(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/office-assistants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          fullName: fullName.trim() || undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await readApiError(response, t("officeAssistants.saveFailed")),
        );
      }
      const payload = (await response.json()) as {
        created?: boolean;
        promoted?: boolean;
      };
      setPhone("");
      setFullName("");
      setMessage({
        tone: "success",
        text: payload.created
          ? t("officeAssistants.created")
          : payload.promoted
            ? t("officeAssistants.promoted")
            : t("officeAssistants.updated"),
      });
      await load();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t("officeAssistants.saveFailed"),
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: AssistantRow) {
    setBusyId(row.userId);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/office-assistants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: row.userId,
          isActive: !row.isActive,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await readApiError(response, t("officeAssistants.updateFailed")),
        );
      }
      await load();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t("officeAssistants.updateFailed"),
      });
    } finally {
      setBusyId(null);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15";

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-lg font-semibold text-slate-deep">
        {t("officeAssistants.title")}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{t("officeAssistants.lede")}</p>

      <form
        onSubmit={addAssistant}
        className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <label>
          <span className="text-sm font-semibold text-slate-700">
            {t("officeAssistants.phone")}
          </span>
          <input
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={fieldClass}
            placeholder={t("officeAssistants.phonePlaceholder")}
            inputMode="tel"
          />
        </label>
        <label>
          <span className="text-sm font-semibold text-slate-700">
            {t("officeAssistants.fullName")}
          </span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={fieldClass}
            placeholder={t("officeAssistants.fullNamePlaceholder")}
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving || phone.trim().length < 9}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-45 sm:w-auto"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {saving ? t("common.loading") : t("officeAssistants.addCta")}
          </button>
        </div>
      </form>

      {message ? (
        <p
          role="status"
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${
            message.tone === "success"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">{t("officeAssistants.empty")}</p>
      ) : (
        <ul className="mt-5 grid gap-2">
          {rows.map((row) => (
            <li
              key={row.userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-deep">{row.fullName}</p>
                <p className="text-xs text-ink-muted">
                  {row.phone ?? "—"}
                  {row.isActive
                    ? ` · ${t("officeAssistants.active")}`
                    : ` · ${t("officeAssistants.inactive")}`}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === row.userId}
                onClick={() => void toggleActive(row)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-45"
              >
                {busyId === row.userId ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : row.isActive ? (
                  <UserMinus className="h-3.5 w-3.5" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                {row.isActive
                  ? t("officeAssistants.deactivate")
                  : t("officeAssistants.activate")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
