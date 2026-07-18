"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

type ProfileFormProps = {
  initialFullName: string;
  initialEmail: string | null;
  phone: string | null;
  roleLabel: string;
};

export function ProfileForm({
  initialFullName,
  initialEmail,
  phone,
  roleLabel,
}: ProfileFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? t("profile.saveFailed"));
      }
      setMessage({ tone: "success", text: t("profile.saved") });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : t("profile.saveFailed"),
      });
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15";

  return (
    <form onSubmit={save} className="grid max-w-xl gap-5">
      <label>
        <span className="text-sm font-semibold text-slate-700">
          {t("profile.phone")}
        </span>
        <input
          value={phone ?? ""}
          readOnly
          className={`${fieldClass} bg-slate-50 font-mono text-slate-600`}
        />
        <span className="mt-1 block text-xs text-slate-500">
          {t("profile.phoneLocked")}
        </span>
      </label>

      <label>
        <span className="text-sm font-semibold text-slate-700">
          {t("auth.role.label")}
        </span>
        <input
          value={roleLabel}
          readOnly
          className={`${fieldClass} bg-slate-50 text-slate-600`}
        />
        <span className="mt-1 block text-xs text-slate-500">
          {t("auth.role.locked")}
        </span>
      </label>

      <label>
        <span className="text-sm font-semibold text-slate-700">
          {t("auth.fullName")}
        </span>
        <input
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className={fieldClass}
          autoComplete="name"
        />
      </label>

      <label>
        <span className="text-sm font-semibold text-slate-700">
          {t("profile.email")}
        </span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
          placeholder={t("profile.emailPlaceholder")}
          autoComplete="email"
        />
        <span className="mt-1 block text-xs text-slate-500">
          {t("profile.emailHint")}
        </span>
      </label>

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

      <button
        type="submit"
        disabled={busy || fullName.trim().length < 2}
        className="w-fit rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-45"
      >
        {busy ? t("common.loading") : t("profile.save")}
      </button>
    </form>
  );
}
