"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, LoaderCircle, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

type AlertRow = {
  id: string;
  title: string;
  message: string;
  severity: string;
  listingId: string | null;
  isRead: boolean;
  createdAt: string;
};

type AdminAlertsBellProps = {
  /** When true, open the popup automatically if there are unread alerts. */
  autoOpenOnUnread?: boolean;
};

export function AdminAlertsBell({
  autoOpenOnUnread = true,
}: AdminAlertsBellProps) {
  const { locale, t } = useTranslation();
  const pathname = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [autoOpened, setAutoOpened] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/alerts?limit=8&unread=1");
      const payload = (await response.json()) as {
        data?: { unreadCount: number; alerts: AlertRow[] };
      };
      if (!response.ok) return;
      setUnreadCount(payload.data?.unreadCount ?? 0);
      setAlerts(payload.data?.alerts ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    if (autoOpened || loading || unreadCount === 0) return;
    if (!autoOpenOnUnread) return;
    if (!pathname.includes("/workspace/admin")) return;
    try {
      const key = "ethiomls-admin-alerts-auto-open";
      if (sessionStorage.getItem(key)) {
        setAutoOpened(true);
        return;
      }
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setOpen(true);
    setAutoOpened(true);
  }, [autoOpenOnUnread, autoOpened, unreadCount, loading, pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markAllRead() {
    const response = await fetch("/api/admin/alerts/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!response.ok) return;
    setUnreadCount(0);
    setAlerts([]);
  }

  async function markOneRead(id: string) {
    const response = await fetch("/api/admin/alerts/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    if (!response.ok) return;
    setAlerts((prev) => prev.filter((row) => row.id !== id));
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  const base = `/${locale}`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("adminAlerts.bellLabel")}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
      >
        <Bell className="h-4.5 w-4.5 h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[0.65rem] font-bold leading-4 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("adminAlerts.title")}
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card-hover)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t("adminAlerts.title")}
              </p>
              <p className="text-xs text-slate-500">
                {t("adminAlerts.unreadCount", {
                  count: String(unreadCount),
                })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                >
                  {t("adminAlerts.markAllRead")}
                </button>
              ) : null}
              <button
                type="button"
                aria-label={t("adminAlerts.close")}
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {loading && alerts.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {t("adminAlerts.loading")}
              </div>
            ) : alerts.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {t("adminAlerts.empty")}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {alerts.map((alert) => (
                  <li key={alert.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-600/15">
                        {alert.severity}
                      </span>
                      <span className="text-[0.65rem] text-slate-400">
                        {new Date(alert.createdAt).toLocaleString(locale)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900">
                      {alert.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                      {alert.message}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {alert.listingId ? (
                        <Link
                          href={`${base}/listings/${alert.listingId}`}
                          className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                          onClick={() => {
                            void markOneRead(alert.id);
                            setOpen(false);
                          }}
                        >
                          {t("adminAlerts.openListing")}
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-500 hover:text-slate-800"
                        onClick={() => void markOneRead(alert.id)}
                      >
                        {t("adminAlerts.dismiss")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 px-4 py-2.5">
            <Link
              href={`${base}/workspace/admin#admin-alerts`}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800"
              onClick={() => setOpen(false)}
            >
              {t("adminAlerts.viewAll")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
