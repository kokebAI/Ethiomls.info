import {
  AdminHomeTabs,
  type AdminHomeAlertItem,
} from "@/components/admin/AdminHomeTabs";
import type { OpsQueueChip } from "@/components/admin/IntegrationsStatusPanel";
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
  tabOverview?: string;
  tabAlerts?: string;
  tabServices?: string;
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

  const opsChips: OpsQueueChip[] = [
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
    <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-7xl flex-col px-4 py-3 sm:px-6 lg:py-4">
      <AdminHomeTabs
        locale={locale}
        dictionary={dictionary}
        metrics={metrics}
        welcomeName={welcomeName}
        alerts={alerts}
        integrations={integrations}
        opsChips={opsChips}
        tabOverview={copy.tabOverview ?? "Overview"}
        tabAlerts={copy.tabAlerts ?? "Alerts"}
        tabServices={copy.tabServices ?? "Services"}
        alertsTitle={copy.alertsTitle}
        alertsEmpty={copy.alertsEmpty}
        servicesTitle={copy.integrationsTitle ?? copy.snapshotTitle}
        servicesOpsTitle={copy.integrationsOpsTitle ?? "Ops queues"}
        servicesRefresh={copy.integrationsRefresh ?? "Refresh"}
        servicesRefreshing={copy.integrationsRefreshing ?? "Refreshing…"}
      />
    </div>
  );
}
