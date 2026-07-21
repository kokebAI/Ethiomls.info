"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { OfficeAssistantsPanel } from "@/components/admin/OfficeAssistantsPanel";
import type { DashboardMetricsData } from "@/lib/catalog/dashboard-metrics";
import type { Dictionary } from "@/lib/i18n/getDictionary";

export type AdminHomeAlertItem = {
  id: string;
  title: string;
  message: string;
  severity: string;
  listingId: string | null;
  createdAtLabel: string;
};

type AdminHomeTab = "overview" | "staff" | "alerts";

type AdminHomeTabsProps = {
  locale: string;
  dictionary: Dictionary;
  metrics: DashboardMetricsData;
  welcomeName?: string | null;
  alerts: AdminHomeAlertItem[];
  tabOverview: string;
  tabStaff: string;
  tabAlerts: string;
  alertsTitle: string;
  alertsEmpty: string;
};

function tabFromHash(hash: string): AdminHomeTab {
  const id = hash.replace(/^#/, "");
  if (id === "staff") return "staff";
  if (id === "admin-alerts" || id === "alerts") return "alerts";
  return "overview";
}

function hashForTab(tab: AdminHomeTab): string {
  if (tab === "staff") return "#staff";
  if (tab === "alerts") return "#admin-alerts";
  return "#overview";
}

export function AdminHomeTabs({
  locale,
  dictionary,
  metrics,
  welcomeName,
  alerts,
  tabOverview,
  tabStaff,
  tabAlerts,
  alertsTitle,
  alertsEmpty,
}: AdminHomeTabsProps) {
  const base = `/${locale}`;
  const [tab, setTab] = useState<AdminHomeTab>("overview");

  useEffect(() => {
    const apply = () => setTab(tabFromHash(window.location.hash));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const selectTab = useCallback((next: AdminHomeTab) => {
    setTab(next);
    const hash = hashForTab(next);
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }, []);

  const tabs: { id: AdminHomeTab; label: string }[] = [
    { id: "overview", label: tabOverview },
    { id: "staff", label: tabStaff },
    { id: "alerts", label: tabAlerts },
  ];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Admin home"
        className="flex flex-wrap gap-1 rounded-xl border border-slate-200/90 bg-slate-50/80 p-1"
      >
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              id={`admin-home-tab-${item.id}`}
              onClick={() => selectTab(item.id)}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
              }`}
            >
              {item.label}
              {item.id === "alerts" && alerts.length > 0 ? (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-900">
                  {alerts.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        aria-labelledby={`admin-home-tab-${tab}`}
        className="min-h-[12rem]"
      >
        {tab === "overview" ? (
          <DashboardMetrics
            dictionary={dictionary}
            metrics={metrics}
            welcomeName={welcomeName}
            isAdmin
          />
        ) : null}

        {tab === "staff" ? <OfficeAssistantsPanel /> : null}

        {tab === "alerts" ? (
          <section
            id="admin-alerts"
            className="space-y-4 scroll-mt-28"
            aria-labelledby="admin-alerts-heading"
          >
            <h2
              id="admin-alerts-heading"
              className="text-lg font-semibold tracking-tight text-slate-deep"
            >
              {alertsTitle}
            </h2>
            {alerts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center text-sm text-ink-muted">
                {alertsEmpty}
              </p>
            ) : (
              <ul className="space-y-3">
                {alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[var(--shadow-card)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/15">
                        {alert.severity}
                      </span>
                      <span className="text-xs text-slate-400">
                        {alert.createdAtLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {alert.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {alert.message}
                    </p>
                    {alert.listingId ? (
                      <Link
                        href={`${base}/listings/${encodeURIComponent(alert.listingId)}`}
                        className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800"
                      >
                        {alert.listingId}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
