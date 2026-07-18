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
  partyEmpty: string;
};

const TABS: Array<{ id: "all" | AuditPartyCategory; labelKey: keyof AdminPendingQueueCopy }> = [
  { id: "all", labelKey: "partyAll" },
  { id: "developers", labelKey: "partyDevelopers" },
  { id: "brokers", labelKey: "partyBrokers" },
  { id: "owners", labelKey: "partyOwners" },
  { id: "imported", labelKey: "partyImported" },
];

type AdminPendingQueueProps = {
  items: AdminPendingDirectoryItem[];
  copy: AdminPendingQueueCopy;
};

export function AdminPendingQueue({ items, copy }: AdminPendingQueueProps) {
  const [tab, setTab] = useState<"all" | AuditPartyCategory>("all");

  const counts = useMemo(() => {
    const next: Record<"all" | AuditPartyCategory, number> = {
      all: items.length,
      developers: 0,
      brokers: 0,
      owners: 0,
      imported: 0,
    };
    for (const item of items) {
      next[item.party] += 1;
    }
    return next;
  }, [items]);

  const filtered = useMemo(
    () => (tab === "all" ? items : items.filter((item) => item.party === tab)),
    [items, tab],
  );

  const groups = useMemo(() => {
    const map = new Map<string, AdminPendingDirectoryItem[]>();
    for (const item of filtered) {
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
  }, [filtered]);

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

      {groups.length === 0 ? (
        <PageDirectory
          items={[]}
          emptyMessage={tab === "all" ? copy.pendingEmpty : copy.partyEmpty}
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
