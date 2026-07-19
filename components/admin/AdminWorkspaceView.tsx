import Link from "next/link";
import { PageDirectory, type DirectoryItem } from "@/components/PageDirectory";
import {
  AdminPendingQueue,
  type AdminPendingDirectoryItem,
  type AdminPendingQueueCopy,
} from "@/components/admin/AdminPendingQueue";

export type AdminWorkspaceCopy = {
  snapshotTitle: string;
  snapshotPending: string;
  snapshotPendingProjects?: string;
  snapshotAlerts: string;
  snapshotReady: string;
  addListing: string;
  addListingHint: string;
  pendingTitle: string;
  pendingEmpty: string;
  pendingProjectsTitle?: string;
  pendingProjectsEmpty?: string;
  draftsTitle: string;
  draftsEmpty: string;
  readyTitle: string;
  readyEmpty: string;
  alertsTitle: string;
  alertsEmpty: string;
  partyAll: string;
  partyDevelopers: string;
  partyBrokers: string;
  partyOwners: string;
  partyImported: string;
  partyDrafts: string;
  partyVerified: string;
  partyEmpty: string;
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
  pendingCount: number;
  pendingProjectCount?: number;
  unreadAlertCount: number;
  readyCount: number;
  pendingItems: AdminPendingDirectoryItem[];
  pendingProjectItems?: DirectoryItem[];
  draftItems: DirectoryItem[];
  readyItems: DirectoryItem[];
  alerts: AdminAlertItem[];
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        ok ? "bg-emerald-500" : "bg-amber-500"
      }`}
      aria-hidden
    />
  );
}

export function AdminWorkspaceView({
  locale,
  copy,
  pendingCount,
  pendingProjectCount = 0,
  unreadAlertCount,
  readyCount,
  pendingItems,
  pendingProjectItems = [],
  draftItems,
  readyItems,
  alerts,
}: AdminWorkspaceProps) {
  const base = `/${locale}`;

  const pendingQueueCopy: AdminPendingQueueCopy = {
    pendingTitle: copy.pendingTitle,
    pendingEmpty: copy.pendingEmpty,
    partyAll: copy.partyAll,
    partyDevelopers: copy.partyDevelopers,
    partyBrokers: copy.partyBrokers,
    partyOwners: copy.partyOwners,
    partyImported: copy.partyImported,
    partyDrafts: copy.partyDrafts,
    partyVerified: copy.partyVerified,
    partyEmpty: copy.partyEmpty,
    draftsEmpty: copy.draftsEmpty,
    verifiedEmpty: copy.readyEmpty,
  };

  return (
    <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:py-14">
      <section
        className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[var(--shadow-card)] sm:p-6"
        aria-labelledby="admin-snapshot-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2
            id="admin-snapshot-heading"
            className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500"
          >
            {copy.snapshotTitle}
          </h2>
          <div className="flex max-w-md flex-col items-stretch gap-1.5 sm:items-end">
            <Link
              href={`${base}/listings/new`}
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              {copy.addListing}
            </Link>
            <p className="text-xs leading-snug text-ink-muted sm:text-right">
              {copy.addListingHint}
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-3">
          <li className="flex items-start gap-3 text-sm text-ink">
            <StatusDot ok={pendingCount === 0} />
            <span>
              {copy.snapshotPending.replace("{count}", String(pendingCount))}
            </span>
          </li>
          <li className="flex items-start gap-3 text-sm text-ink">
            <StatusDot ok={pendingProjectCount === 0} />
            <span>
              {(
                copy.snapshotPendingProjects ??
                "{count} project(s) awaiting audit"
              ).replace("{count}", String(pendingProjectCount))}
            </span>
          </li>
          <li className="flex items-start gap-3 text-sm text-ink">
            <StatusDot ok={unreadAlertCount === 0} />
            <span>
              {copy.snapshotAlerts.replace(
                "{count}",
                String(unreadAlertCount),
              )}
            </span>
          </li>
          <li className="flex items-start gap-3 text-sm text-ink">
            <StatusDot ok={readyCount > 0 || pendingCount === 0} />
            <span>
              {copy.snapshotReady.replace("{count}", String(readyCount))}
            </span>
          </li>
        </ul>
      </section>

      <AdminPendingQueue
        items={pendingItems}
        draftItems={draftItems}
        verifiedItems={readyItems}
        copy={pendingQueueCopy}
      />

      <section
        id="admin-pending-projects"
        className="space-y-4 scroll-mt-28"
        aria-labelledby="admin-pending-projects-heading"
      >
        <h2
          id="admin-pending-projects-heading"
          className="text-lg font-semibold tracking-tight text-slate-deep"
        >
          {copy.pendingProjectsTitle ?? "Projects awaiting audit"}
        </h2>
        <PageDirectory
          items={pendingProjectItems}
          emptyMessage={
            copy.pendingProjectsEmpty ?? "No projects waiting for audit."
          }
          layout="grid"
        />
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
