import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { PageDirectory, type DirectoryItem } from "@/components/PageDirectory";
import {
  AdminPendingQueue,
  type AdminPendingDirectoryItem,
  type AdminPendingQueueCopy,
} from "@/components/admin/AdminPendingQueue";

export type AdminWorkspaceCopy = {
  eyebrow: string;
  title: string;
  lede: string;
  motto?: string;
  openQueue: string;
  importSources: string;
  dashboard: string;
  accountProfile: string;
  snapshotTitle: string;
  snapshotPending: string;
  snapshotAlerts: string;
  snapshotReady: string;
  pendingTitle: string;
  pendingEmpty: string;
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
  unreadAlertCount: number;
  readyCount: number;
  pendingItems: AdminPendingDirectoryItem[];
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
  unreadAlertCount,
  readyCount,
  pendingItems,
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
    partyEmpty: copy.partyEmpty,
  };

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <PageIntro
        eyebrow={copy.eyebrow}
        title={copy.title}
        lede={copy.lede}
        motto={copy.motto}
      >
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="#admin-pending"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              {copy.openQueue}
            </a>
            <Link
              href={`${base}/admin/imports`}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-50"
            >
              {copy.importSources}
            </Link>
            <Link
              href={`${base}/dashboard`}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-50"
            >
              {copy.dashboard}
            </Link>
            <Link
              href={`${base}/profile`}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-50"
            >
              {copy.accountProfile}
            </Link>
          </div>

          <section
            className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[var(--shadow-card)] sm:p-6"
            aria-labelledby="admin-snapshot-heading"
          >
            <h2
              id="admin-snapshot-heading"
              className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500"
            >
              {copy.snapshotTitle}
            </h2>
            <ul className="mt-4 space-y-3">
              <li className="flex items-start gap-3 text-sm text-ink">
                <StatusDot ok={pendingCount === 0} />
                <span>
                  {copy.snapshotPending.replace(
                    "{count}",
                    String(pendingCount),
                  )}
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

          <AdminPendingQueue items={pendingItems} copy={pendingQueueCopy} />

          <section
            id="admin-drafts"
            className="space-y-4 scroll-mt-28"
            aria-labelledby="admin-drafts-heading"
          >
            <h2
              id="admin-drafts-heading"
              className="text-lg font-semibold tracking-tight text-slate-deep"
            >
              {copy.draftsTitle}
            </h2>
            <PageDirectory
              items={draftItems}
              emptyMessage={copy.draftsEmpty}
              layout="list"
            />
          </section>

          <section className="space-y-4" aria-labelledby="admin-ready-heading">
            <h2
              id="admin-ready-heading"
              className="text-lg font-semibold tracking-tight text-slate-deep"
            >
              {copy.readyTitle}
            </h2>
            <PageDirectory
              items={readyItems}
              emptyMessage={copy.readyEmpty}
              layout="list"
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
                        href={`${base}/listings/${alert.listingId}`}
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
      </PageIntro>
    </div>
  );
}
