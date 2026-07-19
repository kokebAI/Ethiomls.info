"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ethiomls-pwa-install-dismissed";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Registers the service worker and shows an on-page Install control.
 * Chrome no longer auto-shows an install banner — apps must use
 * `beforeinstallprompt` (or the browser ⋮ menu) for install UX.
 */
export function ServiceWorkerRegister() {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((error) => {
          console.error("[pwa] service worker registration failed:", error);
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
      setIosHint(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    let timer: number | undefined;

    if (isIos()) {
      setIosHint(true);
      setVisible(true);
    } else {
      // Chromium may delay BIP; still show where to install from the ⋮ menu.
      timer = window.setTimeout(() => {
        setVisible((current) => current || true);
      }, 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  async function onInstall() {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setVisible(false);
    } catch (error) {
      console.error("[pwa] install prompt failed:", error);
    } finally {
      setInstalling(false);
    }
  }

  function onDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  const body = deferred
    ? t("pwa.installBody")
    : iosHint
      ? t("pwa.iosHint")
      : t("pwa.chromeMenuHint");

  return (
    <div
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] mx-auto w-auto max-w-md rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.22)] backdrop-blur sm:inset-x-auto sm:right-4 sm:left-auto sm:bottom-4"
      role="dialog"
      aria-label={t("pwa.installTitle")}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-amber-300">
          <Download className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {t("pwa.installTitle")}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{body}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {deferred ? (
              <button
                type="button"
                onClick={() => void onInstall()}
                disabled={installing}
                className="rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {installing ? t("pwa.installing") : t("pwa.installAction")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {t("pwa.dismiss")}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label={t("pwa.dismiss")}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
