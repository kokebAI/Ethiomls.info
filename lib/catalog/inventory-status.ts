import { InventoryStatus, ListingStatus, type Listing } from "@prisma/client";
import type { BuildingUnitStatus } from "@/lib/building/types";

export type InventoryListingFields = Pick<
  Listing,
  "inventoryStatus" | "status" | "metadataTags" | "virtualWalkthroughConfig"
>;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function toBuildingUnitStatus(
  inventoryStatus: InventoryStatus | string | null | undefined,
): BuildingUnitStatus {
  switch (inventoryStatus) {
    case InventoryStatus.RESERVED:
    case "RESERVED":
    case "reserved":
      return "reserved";
    case InventoryStatus.SOLD:
    case "SOLD":
    case "sold":
      return "sold";
    default:
      return "available";
  }
}

export function fromBuildingUnitStatus(
  status: BuildingUnitStatus | string,
): InventoryStatus {
  switch (status.toLowerCase()) {
    case "reserved":
      return InventoryStatus.RESERVED;
    case "sold":
      return InventoryStatus.SOLD;
    default:
      return InventoryStatus.AVAILABLE;
  }
}

/**
 * Prefer first-class inventoryStatus; fall back to legacy tags / config /
 * publication status for any rows not yet backfilled.
 */
export function resolveInventoryStatus(
  listing: InventoryListingFields,
): BuildingUnitStatus {
  if (listing.inventoryStatus) {
    return toBuildingUnitStatus(listing.inventoryStatus);
  }

  const fromConfig = asRecord(listing.virtualWalkthroughConfig).inventoryStatus;
  if (
    fromConfig === "available" ||
    fromConfig === "reserved" ||
    fromConfig === "sold"
  ) {
    return fromConfig;
  }

  for (const tag of listing.metadataTags ?? []) {
    const match = /^status:(available|reserved|sold)$/i.exec(tag.trim());
    if (match) return match[1].toLowerCase() as BuildingUnitStatus;
  }

  switch (listing.status) {
    case ListingStatus.SOLD:
      return "sold";
    case ListingStatus.UNDER_OFFER:
    case ListingStatus.RENTED:
      return "reserved";
    default:
      return "available";
  }
}

/** Keep metadataTags + walkthrough config in sync when inventoryStatus changes. */
export function inventoryStatusSideEffects(status: InventoryStatus): {
  metadataTag: string;
  inventoryStatusKey: BuildingUnitStatus;
} {
  const key = toBuildingUnitStatus(status);
  return {
    metadataTag: `status:${key}`,
    inventoryStatusKey: key,
  };
}

export function mergeInventoryMetadataTags(
  existing: string[],
  status: InventoryStatus,
): string[] {
  const nextTag = inventoryStatusSideEffects(status).metadataTag;
  const without = existing.filter(
    (tag) => !/^status:(available|reserved|sold)$/i.test(tag.trim()),
  );
  return [...without, nextTag];
}
