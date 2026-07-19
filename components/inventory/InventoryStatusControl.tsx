"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  fromBuildingUnitStatus,
  toBuildingUnitStatus,
} from "@/lib/catalog/inventory-status";
import type { BuildingUnitStatus } from "@/lib/building/types";

type InventoryStatusValue = "AVAILABLE" | "RESERVED" | "SOLD";

const OPTIONS: Array<{ value: InventoryStatusValue; ui: BuildingUnitStatus }> = [
  { value: "AVAILABLE", ui: "available" },
  { value: "RESERVED", ui: "reserved" },
  { value: "SOLD", ui: "sold" },
];

type InventoryStatusControlProps = {
  listingId: string;
  status: BuildingUnitStatus;
  labels: {
    available: string;
    reserved: string;
    sold: string;
    failed: string;
  };
  onUpdated?: (status: BuildingUnitStatus) => void;
};

export function InventoryStatusControl({
  listingId,
  status: initial,
  labels,
  onUpdated,
}: InventoryStatusControlProps) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(nextUi: BuildingUnitStatus) {
    if (nextUi === status || busy) return;
    const previous = status;
    setStatus(nextUi);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/listings/${listingId}/inventory`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryStatus: fromBuildingUnitStatus(nextUi),
        }),
      });
      const payload = (await response.json()) as {
        message?: string;
        data?: { inventoryStatus?: InventoryStatusValue };
      };
      if (!response.ok) {
        throw new Error(payload.message ?? labels.failed);
      }
      const confirmed = payload.data?.inventoryStatus
        ? toBuildingUnitStatus(payload.data.inventoryStatus)
        : nextUi;
      setStatus(confirmed);
      onUpdated?.(confirmed);
    } catch (err) {
      setStatus(previous);
      setError(err instanceof Error ? err.message : labels.failed);
    } finally {
      setBusy(false);
    }
  }

  const labelFor = (ui: BuildingUnitStatus) => {
    if (ui === "reserved") return labels.reserved;
    if (ui === "sold") return labels.sold;
    return labels.available;
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="inline-flex items-center gap-1.5">
        {busy ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-slate-400" />
        ) : null}
        <select
          value={status}
          disabled={busy}
          onChange={(event) =>
            void change(event.target.value as BuildingUnitStatus)
          }
          onClick={(event) => event.stopPropagation()}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 disabled:opacity-50"
          aria-label={labelFor(status)}
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.ui}>
              {labelFor(option.ui)}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="max-w-[12rem] text-right text-[11px] text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
