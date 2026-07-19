"use client";

import Link from "next/link";
import { InventoryStatusControl } from "@/components/inventory/InventoryStatusControl";
import type { BuildingUnitStatus } from "@/lib/building/types";

export type ProjectInventoryUnitRow = {
  id: string;
  label: string;
  floor: number;
  status: BuildingUnitStatus;
  href: string;
};

type ProjectInventoryEditorProps = {
  units: ProjectInventoryUnitRow[];
  title: string;
  lede: string;
  labels: {
    available: string;
    reserved: string;
    sold: string;
    failed: string;
    floor: string;
  };
};

export function ProjectInventoryEditor({
  units,
  title,
  lede,
  labels,
}: ProjectInventoryEditorProps) {
  if (units.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-lg font-semibold text-slate-deep">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{lede}</p>
      <ul className="mt-4 divide-y divide-slate-100">
        {units.map((unit) => (
          <li
            key={unit.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <Link
                href={unit.href}
                className="font-medium text-slate-900 hover:text-emerald-800 hover:underline"
              >
                {unit.label}
              </Link>
              <p className="text-xs text-slate-500">
                {labels.floor} {unit.floor} · {unit.id}
              </p>
            </div>
            <InventoryStatusControl
              listingId={unit.id}
              status={unit.status}
              labels={{
                available: labels.available,
                reserved: labels.reserved,
                sold: labels.sold,
                failed: labels.failed,
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
