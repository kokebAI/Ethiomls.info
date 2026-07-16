"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

type AuthMode = "login" | "register";

type AuthPanelProps = {
  googleEnabled: boolean;
  initialError?: string | null;
};

export function AuthPanel({ googleEnabled, initialError }: AuthPanelProps) {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [hint, setHint] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  async function requestOtp() {
    setBusy(true);
    setError(null);
    setHint(null);
    setDebugCode(null);
    try {
      const res = await fetch("/api/auth/sms/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          fullName: mode === "register" ? fullName : undefined,
          locale,
        }),
      });
      const data = (await res.json()) as {
        message?: string;
        debugCode?: string;
        provider?: string;
      };
      if (!res.ok) throw new Error(data.message ?? t("auth.smsFailed"));
      setStep("code");
      setHint(
        data.provider === "mock"
          ? t("auth.mockHint")
          : t("auth.codeSent"),
      );
      if (data.debugCode) setDebugCode(data.debugCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.smsFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, mode }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? t("auth.verifyFailed"));
      router.push(`/${locale}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.verifyFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid w-full gap-5">
      <div
        className="inline-flex w-fit gap-1 rounded-full bg-slate-100/80 p-1"
        role="tablist"
      >
        {(["login", "register"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              mode === tab
                ? "bg-slate-deep text-white"
                : "text-ink-muted hover:text-slate-deep"
            }`}
            onClick={() => {
              setMode(tab);
              setStep("phone");
              setError(null);
              setHint(null);
            }}
          >
            {tab === "login" ? t("auth.loginTab") : t("auth.registerTab")}
          </button>
        ))}
      </div>

      {step === "phone" ? (
        <div className="grid gap-3">
          {mode === "register" ? (
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-200">
                {t("auth.fullName")}
              </span>
              <input
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white outline-none backdrop-blur placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                placeholder={t("auth.fullNamePlaceholder")}
              />
            </label>
          ) : null}
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-200">
              {t("auth.phone")}
            </span>
            <input
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white outline-none backdrop-blur placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+2519…"
            />
          </label>
          <button
            type="button"
            disabled={busy || phone.trim().length < 9}
            className="rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-45"
            onClick={() => void requestOtp()}
          >
            {busy ? t("common.loading") : t("auth.sendCode")}
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-200">
              {t("auth.otp")}
            </span>
            <input
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 tracking-[0.35em] text-white outline-none backdrop-blur focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
            />
          </label>
          {debugCode ? (
            <p className="rounded-lg bg-white/10 px-3 py-2 text-xs text-brand-200">
              {t("auth.debugCode")}: <strong>{debugCode}</strong>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || code.length !== 6}
              className="rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-45"
              onClick={() => void verifyOtp()}
            >
              {busy ? t("common.loading") : t("auth.verify")}
            </button>
            <button
              type="button"
              className="rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
              onClick={() => {
                setStep("phone");
                setCode("");
              }}
            >
              {t("auth.back")}
            </button>
          </div>
        </div>
      )}

      {hint ? (
        <p className="text-sm text-slate-300" role="status">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-transparent px-3 text-xs uppercase tracking-wide text-slate-400">
            {t("auth.or")}
          </span>
        </div>
      </div>

      {googleEnabled ? (
        <a
          href={`/api/auth/google?locale=${locale}`}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          {t("auth.continueGoogle")}
        </a>
      ) : (
        <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-xs leading-relaxed text-slate-400">
          {t("auth.googleNotConfigured")}
        </p>
      )}

      <p className="text-center text-xs text-slate-400">
        <Link href={`/${locale}`} className="underline-offset-2 hover:underline">
          {t("auth.backHome")}
        </Link>
      </p>
    </div>
  );
}
