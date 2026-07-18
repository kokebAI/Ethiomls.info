"use client";

import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

type ChangePasswordFormProps = {
  /** True when the account already has a real (non-OAuth) password */
  requiresCurrentPassword: boolean;
};

export function ChangePasswordForm({
  requiresCurrentPassword,
}: ChangePasswordFormProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (newPassword.trim().length < 8) {
        throw new Error(t("auth.password.tooShort"));
      }
      if (newPassword !== confirmPassword) {
        throw new Error(t("auth.password.mismatch"));
      }
      if (requiresCurrentPassword && currentPassword.trim().length < 8) {
        throw new Error(t("profile.password.currentRequired"));
      }

      const response = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: requiresCurrentPassword
            ? currentPassword
            : undefined,
          newPassword,
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? t("profile.password.failed"));
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ tone: "success", text: t("profile.password.saved") });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t("profile.password.failed"),
      });
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15";

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-5">
      <div>
        <h2 className="text-base font-bold text-slate-deep">
          {t("profile.password.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {requiresCurrentPassword
            ? t("profile.password.lede")
            : t("profile.password.ledeSet")}
        </p>
      </div>

      {requiresCurrentPassword ? (
        <label>
          <span className="text-sm font-semibold text-slate-700">
            {t("profile.password.current")}
          </span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={fieldClass}
            autoComplete="current-password"
            placeholder={t("auth.password.placeholder")}
          />
        </label>
      ) : null}

      <label>
        <span className="text-sm font-semibold text-slate-700">
          {t("profile.password.next")}
        </span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={fieldClass}
          autoComplete="new-password"
          placeholder={t("auth.password.placeholder")}
        />
      </label>

      <label>
        <span className="text-sm font-semibold text-slate-700">
          {t("auth.password.confirm")}
        </span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={fieldClass}
          autoComplete="new-password"
          placeholder={t("auth.password.placeholder")}
        />
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
        disabled={
          busy ||
          newPassword.trim().length < 8 ||
          newPassword !== confirmPassword ||
          (requiresCurrentPassword && currentPassword.trim().length < 8)
        }
        className="w-fit rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-45"
      >
        {busy ? t("common.loading") : t("profile.password.save")}
      </button>
    </form>
  );
}
