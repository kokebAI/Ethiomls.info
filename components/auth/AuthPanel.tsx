"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  SIGNUP_ROLE_OPTIONS,
  type SignupRole,
} from "@/lib/auth/signup-roles";
import { hubPathForRole } from "@/lib/roles/hubs";

type AuthMode = "login" | "register";

type AuthPanelProps = {
  initialError?: string | null;
  initialMode?: AuthMode;
  /** Server-detected Google OAuth env readiness */
  googleEnabled?: boolean;
};

const fieldClass =
  "rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white outline-none backdrop-blur placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

export function AuthPanel({
  initialError,
  initialMode,
  googleEnabled = false,
}: AuthPanelProps) {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(initialMode ?? "login");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [role, setRole] = useState<SignupRole | "">("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [hint, setHint] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  const next = searchParams.get("next");
  const showGoogle =
    googleEnabled &&
    step === "credentials" &&
    (mode === "login" || role === "BUYER_RENTER");

  function googleHref() {
    const params = new URLSearchParams({ locale, mode });
    if (next?.startsWith("/")) params.set("next", next);
    return `/api/auth/google?${params.toString()}`;
  }

  function goToHub(roleName?: string) {
    const destination =
      next && next.startsWith("/")
        ? next
        : `/${locale}${hubPathForRole(roleName)}`;
    router.push(destination);
    router.refresh();
  }

  async function loginWithPassword() {
    setBusy(true);
    setError(null);
    setHint(null);
    setDebugCode(null);
    try {
      if (password.trim().length < 8) {
        throw new Error(t("auth.password.tooShort"));
      }
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        needsOtp?: boolean;
        debugCode?: string;
        provider?: string;
        user?: { role?: string };
      };
      if (!res.ok) throw new Error(data.message ?? t("auth.loginFailed"));

      if (data.needsOtp) {
        setStep("code");
        setHint(
          data.provider === "mock"
            ? t("auth.mockHint")
            : t("auth.newDeviceHint"),
        );
        if (data.debugCode) setDebugCode(data.debugCode);
        return;
      }

      goToHub(data.user?.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function registerRequestOtp() {
    setBusy(true);
    setError(null);
    setHint(null);
    setDebugCode(null);
    try {
      if (!role) throw new Error(t("auth.role.required"));
      if (fullName.trim().length < 2) {
        throw new Error(t("auth.fullName"));
      }
      if (password.trim().length < 8) {
        throw new Error(t("auth.password.tooShort"));
      }
      if (password !== passwordConfirm) {
        throw new Error(t("auth.password.mismatch"));
      }

      const res = await fetch("/api/auth/sms/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          fullName,
          role,
          mode: "register",
          locale,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        debugCode?: string;
        provider?: string;
      };
      if (!res.ok) throw new Error(data.message ?? t("auth.smsFailed"));
      setStep("code");
      setHint(
        data.provider === "mock" ? t("auth.mockHint") : t("auth.codeSent"),
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
        body: JSON.stringify({
          phone,
          code,
          mode,
          password: mode === "register" ? password : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        user?: { role?: string };
      };
      if (!res.ok) throw new Error(data.message ?? t("auth.verifyFailed"));
      goToHub(data.user?.role);
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
              setStep("credentials");
              setError(null);
              setHint(null);
              setDebugCode(null);
              setCode("");
            }}
          >
            {tab === "login" ? t("auth.loginTab") : t("auth.registerTab")}
          </button>
        ))}
      </div>

      {step === "credentials" ? (
        <div className="grid gap-3">
          {mode === "register" ? (
            <>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-200">
                  {t("auth.fullName")}
                </span>
                <input
                  className={fieldClass}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  placeholder={t("auth.fullNamePlaceholder")}
                />
              </label>

              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium text-slate-200">
                  {t("auth.role.label")}
                </legend>
                <p className="text-xs text-slate-400">{t("auth.role.hint")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SIGNUP_ROLE_OPTIONS.map((option) => {
                    const selected = role === option.role;
                    return (
                      <label
                        key={option.role}
                        className={`cursor-pointer rounded-xl border px-3 py-3 transition ${
                          selected
                            ? "border-brand-400 bg-brand-500/20 ring-2 ring-brand-400/40"
                            : "border-white/15 bg-white/5 hover:border-white/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="signup-role"
                          className="sr-only"
                          checked={selected}
                          onChange={() => setRole(option.role)}
                        />
                        <span className="block text-sm font-semibold text-white">
                          {t(option.labelKey)}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-slate-300">
                          {t(option.hintKey)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-200">
              {t("auth.phone")}
            </span>
            <input
              className={fieldClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder={t("auth.phonePlaceholder")}
            />
            <span className="text-xs text-slate-400">{t("auth.phoneHint")}</span>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-200">
              {t("auth.password.label")}
            </span>
            <input
              type="password"
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder={t("auth.password.placeholder")}
            />
            <span className="text-xs text-slate-400">
              {t("auth.password.hint")}
            </span>
          </label>

          {mode === "register" ? (
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-200">
                {t("auth.password.confirm")}
              </span>
              <input
                type="password"
                className={fieldClass}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder={t("auth.password.placeholder")}
              />
            </label>
          ) : null}

          <button
            type="button"
            disabled={
              busy ||
              phone.trim().length < 9 ||
              password.trim().length < 8 ||
              (mode === "register" &&
                (fullName.trim().length < 2 ||
                  !role ||
                  password !== passwordConfirm))
            }
            className="rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-45"
            onClick={() =>
              void (mode === "login" ? loginWithPassword() : registerRequestOtp())
            }
          >
            {busy
              ? t("common.loading")
              : mode === "login"
                ? t("auth.loginCta")
                : t("auth.registerCta")}
          </button>

          {showGoogle ? (
            <>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-white/15" />
                {t("auth.or")}
                <span className="h-px flex-1 bg-white/15" />
              </div>
              <a
                href={googleHref()}
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                {t("auth.googleCta")}
              </a>
            </>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-slate-300">
            {mode === "login"
              ? t("auth.newDeviceHint")
              : t("auth.codeSent")}
          </p>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-200">
              {t("auth.otp")}
            </span>
            <input
              className={`${fieldClass} tracking-[0.35em]`}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
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
                setStep("credentials");
                setCode("");
                setDebugCode(null);
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

      <p className="text-center text-xs text-slate-400">
        <Link href={`/${locale}`} className="underline-offset-2 hover:underline">
          {t("auth.backHome")}
        </Link>
      </p>
    </div>
  );
}
