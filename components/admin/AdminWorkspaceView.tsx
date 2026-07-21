import Link from "next/link";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
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
  toolsTitle?: string;
  toolsScrapeReview?: string;
  toolsScrapeReviewHint?: string;
  toolsImports?: string;
  toolsImportsHint?: string;
  toolsAlerts?: string;
  toolsAlertsHint?: string;
  toolsProjects?: string;
  toolsProjectsHint?: string;
  toolsQueue?: string;
  toolsQueueHint?: string;
  toolsProfile?: string;
  toolsProfileHint?: string;
  alertsTitle: string;
  alertsEmpty: string;
};

export type AdminAlertItem = {
  id: string;
  title: string;
  message: string;
  severity: string;
  listingId: string | null;
  createdAtLabel: string;
};

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

type AdminToolLink = {
  href: string;
  label: string;
  hint: string;
  count?: number;
  primary?: boolean;
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

  const tools: AdminToolLink[] = [
    {
      href: `${base}/admin/audit`,
      label: copy.toolsQueue ?? "Listing audit queue",
      hint:
        copy.toolsQueueHint ??
        "Pending, drafts, and verified listings ready to publish.",
      count: pendingCount,
      primary: pendingCount > 0,
    },
    {
      href: `${base}/admin/audit#admin-pending-projects`,
      label: copy.toolsProjects ?? "Projects awaiting audit",
      hint:
        copy.toolsProjectsHint ??
        "Review developer projects before they go public.",
      count: pendingProjectCount,
    },
    {
      href: `${base}/admin/scrape-review`,
      label: copy.toolsScrapeReview ?? "Scrape invite review",
      hint:
        copy.toolsScrapeReviewHint ??
        "Approve scraped listings and send HaHu invite SMS.",
      count: scrapeInviteCount,
      primary: scrapeInviteCount > 0,
    },
    {
      href: `${base}/admin/imports`,
      label: copy.toolsImports ?? "Import sources",
      hint:
        copy.toolsImportsHint ??
        "Telegram, websites, Facebook pages, and sales-kit uploads.",
    },
    {
      href: `${base}/workspace/admin#admin-alerts`,
      label: copy.toolsAlerts ?? "Unread alerts",
      hint: copy.toolsAlertsHint ?? "Collision and system alerts waiting for you.",
      count: unreadAlertCount,
      primary: unreadAlertCount > 0,
    },
    {
      href: `${base}/listings/new`,
      label: copy.addListing,
      hint: copy.addListingHint,
    },
    {
      href: `${base}/profile`,
      label: copy.toolsProfile ?? "Account profile",
      hint: copy.toolsProfileHint ?? "Your admin account settings.",
    },
  ];

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
    <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:py-8">
      <IntegrationsStatusPanel
        initialIntegrations={integrations}
        opsChips={opsChips}
        title={copy.integrationsTitle ?? copy.snapshotTitle}
        opsTitle={copy.integrationsOpsTitle ?? "Ops queues"}
        refreshLabel={copy.integrationsRefresh ?? "Refresh"}
        refreshingLabel={copy.integrationsRefreshing ?? "Refreshing…"}
        headerAction={
          <Link
            href={`${base}/listings/new`}
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-700"
            title={copy.addListingHint}
          >
            {copy.addListing}
          </Link>
        }
      />

      <DashboardMetrics
        dictionary={dictionary}
        metrics={metrics}
        welcomeName={welcomeName}
        isAdmin
      />

      <section
        id="admin-tools"
        className="space-y-4 scroll-mt-28"
        aria-labelledby="admin-tools-heading"
      >
        <h2
          id="admin-tools-heading"
          className="text-lg font-semibold tracking-tight text-slate-deep"
        >
          {copy.toolsTitle ?? "Admin tools"}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <li key={tool.href + tool.label}>
              <Link
                href={tool.href}
                className={`block h-full rounded-2xl border px-4 py-4 transition hover:border-brand-300 hover:bg-brand-50/40 ${
                  tool.primary
                    ? "border-brand-200 bg-brand-50/50"
                    : "border-slate-200/90 bg-white/90"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">
                    {tool.label}
                  </span>
                  {typeof tool.count === "number" ? (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                        tool.count > 0
                          ? "bg-amber-100 text-amber-900"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {tool.count}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                  {tool.hint}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="admin-alerts"
        className="space-y-4 scroll-mt-28"
        aria-labelledby="admin-alerts-heading"
      >
        <h2
          id="admin-alerts-heading"
          className="text-lg font-semibold tracking-tight text-slate-deep"
        >
          {copy.alertsTitle}
        </h2>
        {alerts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center text-sm text-ink-muted">
            {copy.alertsEmpty}
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
    </div>
  );
}
