"use client";

import { useMemo, useState } from "react";
import { PageDirectory, type DirectoryItem } from "@/components/PageDirectory";
import type { AuditPartyCategory } from "@/lib/admin/listing-party";

export type AdminPendingDirectoryItem = DirectoryItem & {
  party: AuditPartyCategory;
  /** Section heading for group-by-developer (or broker/owner fallback). */
  groupLabel: string;
};

export type AdminPendingQueueCopy = {
  pendingTitle: string;
  pendingEmpty: string;
  partyAll: string;
  partyDevelopers: string;
  partyBrokers: string;
  partyOwners: string;
  partyImported: string;
  partyDrafts: string;
  partyVerified: string;
  partyEmpty: string;
  draftsEmpty: string;
  verifiedEmpty: string;
};

type QueueTab = "all" | AuditPartyCategory | "drafts" | "verified";

const TABS: Array<{ id: QueueTab; labelKey: keyof AdminPendingQueueCopy }> = [
  { id: "all", labelKey: "partyAll" },
  { id: "developers", labelKey: "partyDevelopers" },
  { id: "brokers", labelKey: "partyBrokers" },
  { id: "owners", labelKey: "partyOwners" },
  { id: "imported", labelKey: "partyImported" },
  { id: "drafts", labelKey: "partyDrafts" },
  { id: "verified", labelKey: "partyVerified" },
];

type AdminPendingQueueProps = {
  items: AdminPendingDirectoryItem[];
  draftItems: DirectoryItem[];
  verifiedItems: DirectoryItem[];
  copy: AdminPendingQueueCopy;
};

export function AdminPendingQueue({
  items,
  draftItems,
  verifiedItems,
  copy,
}: AdminPendingQueueProps) {
  const [tab, setTab] = useState<QueueTab>("all");

  const counts = useMemo(() => {
    const next: Record<QueueTab, number> = {
      all: items.length,
      developers: 0,
      brokers: 0,
      owners: 0,
      imported: 0,
      drafts: draftItems.length,
      verified: verifiedItems.length,
    };
    for (const item of items) {
      next[item.party] += 1;
    }
    return next;
  }, [items, draftItems.length, verifiedItems.length]);

  const filteredPending = useMemo(
    () => (tab === "all" ? items : items.filter((item) => item.party === tab)),
    [items, tab],
  );

  const groups = useMemo(() => {
    if (tab === "drafts" || tab === "verified") return [];
    const map = new Map<string, AdminPendingDirectoryItem[]>();
    for (const item of filteredPending) {
      const key = item.groupLabel.trim() || "Other";
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }, [filteredPending, tab]);

  const specialItems =
    tab === "drafts" ? draftItems : tab === "verified" ? verifiedItems : null;

  const emptyMessage =
    tab === "drafts"
      ? copy.draftsEmpty
      : tab === "verified"
        ? copy.verifiedEmpty
        : tab === "all"
          ? copy.pendingEmpty
          : copy.partyEmpty;

  return (
    <section
      id="admin-pending"
      className="space-y-4 scroll-mt-28"
      aria-labelledby="admin-pending-heading"
    >
      <h2
        id="admin-pending-heading"
        className="text-lg font-semibold tracking-tight text-slate-deep"
      >
        {copy.pendingTitle}
      </h2>

      <div
        className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/90 bg-white/80 p-1.5"
        role="tablist"
        aria-label={copy.pendingTitle}
      >
        {TABS.map((entry) => {
          const selected = tab === entry.id;
          const count = counts[entry.id];
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(entry.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                selected
                  ? "bg-slate-deep text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {copy[entry.labelKey]}
              <span
                className={`ml-1.5 tabular-nums ${
                  selected ? "text-slate-300" : "text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {specialItems ? (
        <PageDirectory
          items={specialItems}
          emptyMessage={emptyMessage}
          layout="grid"
        />
      ) : groups.length === 0 ? (
        <PageDirectory
          items={[]}
          emptyMessage={emptyMessage}
          layout="grid"
        />
      ) : (
        <div className="space-y-8">
          {groups.map(([label, groupItems]) => (
            <section key={label} className="space-y-3" aria-label={label}>
              <h3 className="flex items-baseline justify-between gap-3 text-sm font-bold uppercase tracking-[0.12em] text-slate-500">
                <span>{label}</span>
                <span className="tabular-nums text-slate-400">
                  {groupItems.length}
                </span>
              </h3>
              <PageDirectory
                items={groupItems}
                emptyMessage={copy.partyEmpty}
                layout="grid"
              />
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
