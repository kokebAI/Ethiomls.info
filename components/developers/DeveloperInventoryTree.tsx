"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  DeveloperInventoryParent,
  DeveloperUnitType,
} from "@/lib/catalog/developer-inventory";
import { formatUnitTypePrice } from "@/lib/catalog/developer-inventory";
import { formatMoney } from "@/lib/compliance/currency";

type Labels = {
  unitTypes: string;
  available: string;
  reserved: string;
  sold: string;
  units: string;
  viewUnit: string;
  kindProject: string;
  kindBuilding: string;
  kindStandalone: string;
};

type DeveloperInventoryTreeProps = {
  parents: DeveloperInventoryParent[];
  emptyMessage: string;
  labels: Labels;
};

function StatusPills({
  type,
  labels,
}: {
  type: DeveloperUnitType;
  labels: Labels;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs font-medium">
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800 ring-1 ring-emerald-600/15 ring-inset">
        {labels.available}: {type.available}
      </span>
      {type.reserved > 0 ? (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-600/15 ring-inset">
          {labels.reserved}: {type.reserved}
        </span>
      ) : null}
      {type.sold > 0 ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 ring-1 ring-slate-500/15 ring-inset">
          {labels.sold}: {type.sold}
        </span>
      ) : null}
    </div>
  );
}

function UnitTypeRow({
  type,
  labels,
}: {
  type: DeveloperUnitType;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={open}
      >
        <span className="mt-0.5 text-slate-400" aria-hidden="true">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-slate-900">{type.label}</span>
            <span className="text-sm font-medium text-slate-600">
              {type.total} {labels.units}
            </span>
          </span>
          <span className="block text-sm text-slate-600">
            {formatUnitTypePrice(type)}
          </span>
          <StatusPills type={type} labels={labels} />
        </span>
      </button>

      {open ? (
        <ul className="space-y-1 border-t border-slate-100 px-4 py-3">
          {type.units.map((unit) => (
            <li key={unit.id}>
              <Link
                href={unit.href}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-emerald-50"
              >
                <span className="font-medium text-slate-800">{unit.label}</span>
                <span className="text-slate-600">
                  {formatMoney(unit.price, unit.currency)}
                  <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">
                    {unit.status}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function kindLabel(kind: DeveloperInventoryParent["kind"], labels: Labels) {
  switch (kind) {
    case "project":
      return labels.kindProject;
    case "building":
      return labels.kindBuilding;
    default:
      return labels.kindStandalone;
  }
}

export function DeveloperInventoryTree({
  parents,
  emptyMessage,
  labels,
}: DeveloperInventoryTreeProps) {
  if (parents.length === 0) {
    return (
      <p
        className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center text-sm leading-relaxed text-slate-600"
        role="status"
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {parents.map((parent) => (
        <li
          key={parent.id}
          className="overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/80 shadow-[var(--shadow-card)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 bg-white px-5 py-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {kindLabel(parent.kind, labels)}
              </p>
              {parent.href ? (
                <Link
                  href={parent.href}
                  className="text-lg font-semibold text-slate-900 hover:text-emerald-800 hover:underline"
                >
                  {parent.title}
                </Link>
              ) : (
                <h3 className="text-lg font-semibold text-slate-900">
                  {parent.title}
                </h3>
              )}
              <p className="text-sm text-slate-600">{parent.meta}</p>
            </div>
            <p className="text-sm font-semibold text-emerald-800">
              {labels.unitTypes}: {parent.unitTypes.length}
            </p>
          </div>

          <ul className="m-0 flex list-none flex-col gap-2 p-4">
            {parent.unitTypes.map((type) => (
              <UnitTypeRow key={type.key} type={type} labels={labels} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
