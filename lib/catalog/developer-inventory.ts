import type { Listing, ListingType, PropertyCategory } from "@prisma/client";
import type { BuildingUnitStatus } from "@/lib/building/types";
import { resolveInventoryStatus } from "@/lib/catalog/inventory-status";
import { formatMoney } from "@/lib/compliance/currency";
import type { Locale } from "@/lib/i18n/config";
import { pickLocalized } from "@/lib/i18n/pickLocalized";

export type InventoryUnitStatus = BuildingUnitStatus;

export type DeveloperInventoryUnit = {
  id: string;
  label: string;
  href: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeM2: number | null;
  price: number;
  currency: "ETB" | "USD";
  status: InventoryUnitStatus;
  listingType: ListingType;
  category: PropertyCategory;
};

export type DeveloperUnitType = {
  /** Stable key for React lists */
  key: string;
  label: string;
  bedrooms: number | null;
  sizeM2: number | null;
  listingType: ListingType;
  category: PropertyCategory;
  total: number;
  available: number;
  reserved: number;
  sold: number;
  priceMin: number;
  priceMax: number;
  currency: "ETB" | "USD";
  units: DeveloperInventoryUnit[];
};

export type DeveloperInventoryParent = {
  id: string;
  kind: "project" | "building" | "standalone";
  title: string;
  href: string | null;
  meta: string;
  totalUnits: number;
  unitTypes: DeveloperUnitType[];
};

type ListingRow = Listing & {
  subCity?: { code: string; name: unknown } | null;
  project?: { id: string; title: unknown } | null;
  units?: Listing[];
};

function inventoryStatus(listing: Listing): InventoryUnitStatus {
  return resolveInventoryStatus(listing);
}

function sizeM2(listing: Listing): number | null {
  return listing.floorAreaSqm != null ? Number(listing.floorAreaSqm) : null;
}

function unitTypeKey(listing: Listing): string {
  const beds = listing.bedrooms ?? "x";
  const area = sizeM2(listing) ?? "x";
  return `${listing.category}|${listing.listingType}|${beds}|${area}`;
}

function unitTypeLabel(
  listing: Listing,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const parts: string[] = [];
  if (listing.bedrooms != null) {
    parts.push(
      listing.bedrooms === 1
        ? `1 ${t("listing.bedroomUnit")}`
        : `${listing.bedrooms} ${t("listing.bedroomsUnit")}`,
    );
  }
  const area = sizeM2(listing);
  if (area != null) parts.push(`${area} m²`);
  if (parts.length === 0) {
    parts.push(
      listing.category
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase()),
    );
  }
  return parts.join(" · ");
}

function toUnit(
  listing: Listing,
  locale: Locale,
  base: string,
): DeveloperInventoryUnit {
  return {
    id: listing.id,
    label: pickLocalized(listing.title, locale) || listing.id,
    href: `${base}/listings/${listing.id}`,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sizeM2: sizeM2(listing),
    price: Number(listing.priceAmount),
    currency: listing.priceCurrency === "USD" ? "USD" : "ETB",
    status: inventoryStatus(listing),
    listingType: listing.listingType,
    category: listing.category,
  };
}

function groupUnitTypes(
  listings: Listing[],
  locale: Locale,
  base: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): DeveloperUnitType[] {
  const map = new Map<string, DeveloperUnitType>();

  for (const listing of listings) {
    const key = unitTypeKey(listing);
    const unit = toUnit(listing, locale, base);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        key,
        label: unitTypeLabel(listing, t),
        bedrooms: listing.bedrooms,
        sizeM2: sizeM2(listing),
        listingType: listing.listingType,
        category: listing.category,
        total: 1,
        available: unit.status === "available" ? 1 : 0,
        reserved: unit.status === "reserved" ? 1 : 0,
        sold: unit.status === "sold" ? 1 : 0,
        priceMin: unit.price,
        priceMax: unit.price,
        currency: unit.currency,
        units: [unit],
      });
      continue;
    }

    existing.total += 1;
    if (unit.status === "available") existing.available += 1;
    if (unit.status === "reserved") existing.reserved += 1;
    if (unit.status === "sold") existing.sold += 1;
    existing.priceMin = Math.min(existing.priceMin, unit.price);
    existing.priceMax = Math.max(existing.priceMax, unit.price);
    existing.units.push(unit);
  }

  return [...map.values()].sort((a, b) => {
    const bedA = a.bedrooms ?? 999;
    const bedB = b.bedrooms ?? 999;
    if (bedA !== bedB) return bedA - bedB;
    return (a.sizeM2 ?? 0) - (b.sizeM2 ?? 0);
  });
}

/**
 * Build a parent → unit-type → units tree for a developer's published inventory.
 *
 * Parents are (in order):
 * 1. Projects with listings
 * 2. Building stacks (listings that have child units via parentId)
 * 3. A "standalone" bucket for listings that are neither project units nor stack children
 */
export function buildDeveloperInventoryTree(input: {
  listings: ListingRow[];
  locale: Locale;
  basePath: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}): DeveloperInventoryParent[] {
  const { listings, locale, basePath: base, t } = input;
  const parents: DeveloperInventoryParent[] = [];
  const claimed = new Set<string>();

  const childIds = new Set(
    listings.filter((l) => l.parentId).map((l) => l.id),
  );

  // --- Projects as parents ---
  const byProject = new Map<string, { title: unknown; listings: Listing[] }>();
  for (const listing of listings) {
    if (!listing.projectId || !listing.project) continue;
    // Prefer project grouping over parent stack for project-linked units
    const bucket = byProject.get(listing.projectId) ?? {
      title: listing.project.title,
      listings: [],
    };
    bucket.listings.push(listing);
    byProject.set(listing.projectId, bucket);
  }

  for (const [projectId, bucket] of byProject) {
    for (const listing of bucket.listings) claimed.add(listing.id);
    const unitTypes = groupUnitTypes(bucket.listings, locale, base, t);
    const totalUnits = unitTypes.reduce((sum, type) => sum + type.total, 0);
    parents.push({
      id: `project:${projectId}`,
      kind: "project",
      title: pickLocalized(bucket.title as never, locale) || projectId,
      href: `${base}/projects/${encodeURIComponent(projectId)}`,
      meta: t("pages.developers.inventory.unitCount", { count: totalUnits }),
      totalUnits,
      unitTypes,
    });
  }

  // --- Building stacks (parent listings with children) not already in a project ---
  const stackParents = listings.filter(
    (l) =>
      !claimed.has(l.id) &&
      !l.parentId &&
      ((l.units && l.units.length > 0) ||
        listings.some((c) => c.parentId === l.id && !claimed.has(c.id))),
  );

  for (const parent of stackParents) {
    const children = listings.filter(
      (c) => c.parentId === parent.id && !claimed.has(c.id),
    );
    // Include parent itself only if it looks like a sellable unit (has price facts)
    const stackUnits =
      children.length > 0
        ? children
        : parent.units && parent.units.length > 0
          ? parent.units
          : [];

    for (const child of stackUnits) claimed.add(child.id);
    claimed.add(parent.id);

    const unitTypes = groupUnitTypes(stackUnits, locale, base, t);
    const totalUnits = unitTypes.reduce((sum, type) => sum + type.total, 0);
    const subCity = parent.subCity
      ? pickLocalized(parent.subCity.name as never, locale) || parent.subCity.code
      : null;

    parents.push({
      id: `building:${parent.id}`,
      kind: "building",
      title: pickLocalized(parent.title, locale) || parent.id,
      href: `${base}/listings/${parent.id}`,
      meta: [subCity, t("pages.developers.inventory.unitCount", { count: totalUnits })]
        .filter(Boolean)
        .join(" · "),
      totalUnits,
      unitTypes,
    });
  }

  // --- Standalone leftovers ---
  const standalone = listings.filter(
    (l) => !claimed.has(l.id) && !childIds.has(l.id),
  );
  if (standalone.length > 0) {
    const unitTypes = groupUnitTypes(standalone, locale, base, t);
    const totalUnits = unitTypes.reduce((sum, type) => sum + type.total, 0);
    parents.push({
      id: "standalone",
      kind: "standalone",
      title: t("pages.developers.inventory.standalone"),
      href: null,
      meta: t("pages.developers.inventory.unitCount", { count: totalUnits }),
      totalUnits,
      unitTypes,
    });
  }

  return parents.sort((a, b) => b.totalUnits - a.totalUnits);
}

export function formatUnitTypePrice(type: DeveloperUnitType): string {
  if (type.priceMin === type.priceMax) {
    return formatMoney(type.priceMin, type.currency);
  }
  return `${formatMoney(type.priceMin, type.currency)} – ${formatMoney(type.priceMax, type.currency)}`;
}
