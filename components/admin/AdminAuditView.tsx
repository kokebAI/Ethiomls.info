import Link from "next/link";
import { PageDirectory, type DirectoryItem } from "@/components/PageDirectory";
import {
  AdminPendingQueue,
  type AdminPendingDirectoryItem,
  type AdminPendingQueueCopy,
} from "@/components/admin/AdminPendingQueue";

export type AdminAuditCopy = {
  pendingTitle: string;
  pendingEmpty: string;
  pendingProjectsTitle?: string;
  pendingProjectsEmpty?: string;
  draftsEmpty: string;
  readyEmpty: string;
  partyAll: string;
  partyDevelopers: string;
  partyBrokers: string;
  partyOwners: string;
  partyImported: string;
  partyDrafts: string;
  partyVerified: string;
  partyEmpty: string;
};

export type AdminAuditViewProps = {
  locale: string;
  copy: AdminAuditCopy;
  pendingItems: AdminPendingDirectoryItem[];
  pendingProjectItems?: DirectoryItem[];
  draftItems: DirectoryItem[];
  readyItems: DirectoryItem[];
};

export function AdminAuditView({
  locale,
  copy,
  pendingItems,
  pendingProjectItems = [],
  draftItems,
  readyItems,
}: AdminAuditViewProps) {
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
    <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:py-8">
      <div id="admin-pending-queue" className="scroll-mt-28">
        <AdminPendingQueue
          items={pendingItems}
          draftItems={draftItems}
          verifiedItems={readyItems}
          copy={pendingQueueCopy}
        />
      </div>

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

      <p className="text-center text-sm text-ink-muted">
        <Link
          href={`${base}/workspace/admin`}
          className="font-semibold text-brand-700 hover:text-brand-800"
        >
          ← Home
        </Link>
      </p>
    </div>
  );
}
