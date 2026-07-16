import type { AddisSubCityCode } from "@/lib/properties/subCities";

export type BuildingUnitStatus = "available" | "reserved" | "sold";

export type BuildingUnit = {
  id: string;
  /** EthioMLS property ID when available (often same as `id`). */
  propertyId?: string;
  /** Display code such as "12A". */
  unitLabel: string;
  floor: number;
  title?: string;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeM2?: number;
  price: number;
  currency: "ETB" | "USD";
  status: BuildingUnitStatus;
  listingType?: "SALE" | "RENT" | "OFF_PLAN";
  amenities?: string[];
};

export type BuildingFloor = {
  /** Integer floor index (0 = ground). Higher values are above ground. */
  level: number;
  label?: string;
  units: BuildingUnit[];
};

/**
 * Structural building model for the vertical scroll viewer.
 * Floors nest their property units; the UI derives availability counts.
 */
export type Building = {
  id: string;
  name: string;
  subCity: AddisSubCityCode | string;
  addressLine?: string;
  developerName?: string;
  floors: BuildingFloor[];
};

export function countAvailableUnits(floor: BuildingFloor): number {
  return floor.units.filter((unit) => unit.status === "available").length;
}

export function sortFloorsTopDown(floors: BuildingFloor[]): BuildingFloor[] {
  return [...floors].sort((a, b) => b.level - a.level);
}
