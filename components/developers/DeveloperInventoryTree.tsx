"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  DeveloperInventoryParent,
  DeveloperInventoryUnit,
  DeveloperUnitType,
  InventoryUnitStatus,
} from "@/lib/catalog/developer-inventory";
import { formatUnitTypePrice } from "@/lib/catalog/developer-inventory";
import { formatMoney } from "@/lib/compliance/currency";
import { InventoryStatusControl } from "@/components/inventory/InventoryStatusControl";

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
  updateFailed?: string;
};

type DeveloperInventoryTreeProps = {
  parents: DeveloperInventoryParent[];
  emptyMessage: string;
  labels: Labels;
  /** When true, show Available/Reserved/Sold editors per unit. */
  canEditInventory?: boolean;
};

function recount(type: DeveloperUnitType): DeveloperUnitType {
  let available = 0;
  let reserved = 0;
  let sold = 0;
  for (const unit of type.units) {
    if (unit.status === "reserved") reserved += 1;
    else if (unit.status === "sold") sold += 1;
    else available += 1;
  }
  return { ...type, available, reserved, sold, total: type.units.length };
}

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

function UnitRow({
  unit,
  labels,
  canEdit,
  onStatusChange,
}: {
  unit: DeveloperInventoryUnit;
  labels: Labels;
  canEdit: boolean;
  onStatusChange: (id: string, status: InventoryUnitStatus) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-emerald-50">
      <Link
        href={unit.href}
        className="min-w-0 flex-1 font-medium text-slate-800 hover:text-emerald-800 hover:underline"
      >
        {unit.label}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-slate-600">
          {formatMoney(unit.price, unit.currency)}
        </span>
        {canEdit ? (
          <InventoryStatusControl
            listingId={unit.id}
            status={unit.status}
            labels={{
              available: labels.available,
              reserved: labels.reserved,
              sold: labels.sold,
              failed: labels.updateFailed ?? "Could not update status",
            }}
            onUpdated={(status) => onStatusChange(unit.id, status)}
          />
        ) : (
          <span className="text-xs uppercase tracking-wide text-slate-400">
            {unit.status}
          </span>
        )}
      </div>
    </li>
  );
}

function UnitTypeRow({
  type: initialType,
  labels,
  canEdit,
}: {
  type: DeveloperUnitType;
  labels: Labels;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(initialType);

  function onStatusChange(id: string, status: InventoryUnitStatus) {
    setType((prev) =>
      recount({
        ...prev,
        units: prev.units.map((unit) =>
          unit.id === id ? { ...unit, status } : unit,
        ),
      }),
    );
  }

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
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-slate-900">{type.label}</p>
            <p className="text-sm text-slate-600">
              {formatUnitTypePrice(type)}
            </p>
          </div>
          <StatusPills type={type} labels={labels} />
          <p className="text-xs text-slate-500">
            {type.total} {labels.units}
          </p>
        </div>
      </button>

      {open ? (
        <ul className="m-0 list-none border-t border-slate-100 px-3 py-2">
          {type.units.map((unit) => (
            <UnitRow
              key={unit.id}
              unit={unit}
              labels={labels}
              canEdit={canEdit}
              onStatusChange={onStatusChange}
            />
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
  canEditInventory = false,
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
              <UnitTypeRow
                key={type.key}
                type={type}
                labels={labels}
                canEdit={canEditInventory}
              />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
