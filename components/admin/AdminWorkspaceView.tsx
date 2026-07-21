import Link from "next/link";
import {
  AdminHomeTabs,
  type AdminHomeAlertItem,
} from "@/components/admin/AdminHomeTabs";
import { IntegrationsStatusPanel } from "@/components/admin/IntegrationsStatusPanel";
import type { IntegrationStatus } from "@/lib/ops/integration-status";
import type { DashboardMetricsData } from "@/lib/catalog/dashboard-metrics";
import type { Dictionary } from "@/lib/i18n/getDictionary";

export type AdminWorkspaceCopy = {
  snapshotTitle: string;
  snapshotPending: string;
  snapshotPendingProjects?: string;
  snapshotScrapeInvites?: string;
  snapshotAlerts: string;
  snapshotReady: string;
  integrationsTitle?: string;
  integrationsOpsTitle?: string;
  integrationsRefresh?: string;
  integrationsRefreshing?: string;
  addListing: string;
  addListingHint: string;
  assistantsLink?: string;
  tabOverview?: string;
  tabStaff?: string;
  tabAlerts?: string;
  alertsTitle: string;
  alertsEmpty: string;
};

export type AdminAlertItem = AdminHomeAlertItem;

export type AdminWorkspaceProps = {
  locale: string;
  copy: AdminWorkspaceCopy;
  dictionary: Dictionary;
  metrics: DashboardMetricsData;
  welcomeName?: string | null;
  integrations: IntegrationStatus[];
  pendingCount: number;
  pendingProjectCount?: number;
  scrapeInviteCount?: number;
  unreadAlertCount: number;
  readyCount: number;
  alerts: AdminAlertItem[];
};

export function AdminWorkspaceView({
  locale,
  copy,
  dictionary,
  metrics,
  welcomeName,
  integrations,
  pendingCount,
  pendingProjectCount = 0,
  scrapeInviteCount = 0,
  unreadAlertCount,
  readyCount,
  alerts,
}: AdminWorkspaceProps) {
  const base = `/${locale}`;

  const opsChips = [
    {
      id: "pending",
      label: copy.snapshotPending.replace("{count}", String(pendingCount)),
      href: `${base}/admin/audit#admin-pending-queue`,
      ok: pendingCount === 0,
    },
    {
      id: "projects",
      label: (
        copy.snapshotPendingProjects ?? "{count} project(s) awaiting audit"
      ).replace("{count}", String(pendingProjectCount)),
      href: `${base}/admin/audit#admin-pending-projects`,
      ok: pendingProjectCount === 0,
    },
    {
      id: "scrape",
      label: (
        copy.snapshotScrapeInvites ?? "{count} scrape invite(s) awaiting SMS"
      ).replace("{count}", String(scrapeInviteCount)),
      href: `${base}/admin/scrape-review`,
      ok: scrapeInviteCount === 0,
    },
    {
      id: "alerts",
      label: copy.snapshotAlerts.replace("{count}", String(unreadAlertCount)),
      href: `${base}/workspace/admin#admin-alerts`,
      ok: unreadAlertCount === 0,
    },
    {
      id: "ready",
      label: copy.snapshotReady.replace("{count}", String(readyCount)),
      href: `${base}/admin/audit`,
      ok: readyCount > 0 || pendingCount === 0,
    },
  ];

  return (
    <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={`${base}/workspace/admin#staff`}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 transition hover:border-brand-300 hover:bg-brand-50/40"
        >
          {copy.assistantsLink ?? copy.tabStaff ?? "Assistants"}
        </Link>
        <Link
          href={`${base}/listings/new`}
          className="inline-flex items-center justify-center rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-700"
          title={copy.addListingHint}
        >
          {copy.addListing}
        </Link>
      </div>

      <AdminHomeTabs
        locale={locale}
        dictionary={dictionary}
        metrics={metrics}
        welcomeName={welcomeName}
        alerts={alerts}
        tabOverview={copy.tabOverview ?? "Overview"}
        tabStaff={copy.tabStaff ?? "Assistants"}
        tabAlerts={copy.tabAlerts ?? "Alerts"}
        alertsTitle={copy.alertsTitle}
        alertsEmpty={copy.alertsEmpty}
      />

      <IntegrationsStatusPanel
        initialIntegrations={integrations}
        opsChips={opsChips}
        title={copy.integrationsTitle ?? copy.snapshotTitle}
        opsTitle={copy.integrationsOpsTitle ?? "Ops queues"}
        refreshLabel={copy.integrationsRefresh ?? "Refresh"}
        refreshingLabel={copy.integrationsRefreshing ?? "Refreshing…"}
      />
    </div>
  );
}
