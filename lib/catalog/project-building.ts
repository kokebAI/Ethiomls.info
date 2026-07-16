import type { Listing, Project } from "@prisma/client";
import type {
  Building,
  BuildingUnit,
  BuildingUnitStatus,
} from "@/lib/building/types";
import type { Locale } from "@/lib/i18n/config";
import { pickLocalized } from "@/lib/i18n/pickLocalized";
import {
  parseFloorFromTags,
  parseUnitLabelFromTags,
} from "@/lib/properties/propertyId";

export type ProjectWithBuildingRelations = Project & {
  developer: {
    tradeName: string;
    displayName: unknown;
    website: string | null;
  };
  subCity: { code: string; name: unknown } | null;
  listings: Listing[];
};

type WalkthroughBag = {
  amenities?: string[];
  inventoryStatus?: string;
  telegram?: string | null;
  website?: string | null;
  sourceUpdatedAt?: string;
  floor?: number;
  unitLabel?: string;
};

function asRecord(value: unknown): WalkthroughBag {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as WalkthroughBag;
}

function inventoryStatus(
  listing: Listing,
): BuildingUnitStatus {
  const fromConfig = asRecord(listing.virtualWalkthroughConfig).inventoryStatus;
  if (
    fromConfig === "available" ||
    fromConfig === "reserved" ||
    fromConfig === "sold"
  ) {
    return fromConfig;
  }

  for (const tag of listing.metadataTags) {
    const match = /^status:(available|reserved|sold)$/i.exec(tag.trim());
    if (match) return match[1].toLowerCase() as BuildingUnitStatus;
  }

  switch (listing.status) {
    case "SOLD":
      return "sold";
    case "UNDER_OFFER":
    case "RENTED":
      return "reserved";
    default:
      return "available";
  }
}

function amenitiesFromListing(listing: Listing): string[] {
  const fromConfig = asRecord(listing.virtualWalkthroughConfig).amenities;
  if (Array.isArray(fromConfig) && fromConfig.length > 0) {
    return fromConfig.filter((a): a is string => typeof a === "string");
  }
  return listing.metadataTags
    .map((tag) => {
      const match = /^amenity:(.+)$/i.exec(tag.trim());
      return match?.[1]?.trim();
    })
    .filter((a): a is string => Boolean(a));
}

function floorForListing(listing: Listing): number {
  const fromConfig = asRecord(listing.virtualWalkthroughConfig).floor;
  if (typeof fromConfig === "number" && Number.isFinite(fromConfig)) {
    return fromConfig;
  }
  return parseFloorFromTags(listing.metadataTags) ?? 0;
}

function unitLabelForListing(listing: Listing): string {
  const fromConfig = asRecord(listing.virtualWalkthroughConfig).unitLabel;
  if (typeof fromConfig === "string" && fromConfig.trim()) {
    return fromConfig.trim();
  }
  return parseUnitLabelFromTags(listing.metadataTags) ?? listing.id.slice(-4);
}

/**
 * Map a Project + its Listings into a Building for BuildingScrollView.
 */
export function projectToBuilding(
  project: ProjectWithBuildingRelations,
  locale: Locale,
): Building {
  const developerName =
    pickLocalized(project.developer.displayName as never, locale) ||
    project.developer.tradeName;

  const byFloor = new Map<number, BuildingUnit[]>();

  for (const listing of project.listings) {
    const floor = floorForListing(listing);
    const unitLabel = unitLabelForListing(listing);
    const amenities = amenitiesFromListing(listing);
    const title = pickLocalized(listing.title, locale) || unitLabel;

    const unit: BuildingUnit = {
      id: listing.id,
      propertyId: listing.id,
      unitLabel,
      floor,
      title,
      description: pickLocalized(listing.description, locale) || undefined,
      bedrooms: listing.bedrooms ?? undefined,
      bathrooms: listing.bathrooms ?? undefined,
      sizeM2:
        listing.floorAreaSqm != null
          ? Number(listing.floorAreaSqm)
          : undefined,
      price: Number(listing.priceAmount),
      currency: listing.priceCurrency === "USD" ? "USD" : "ETB",
      status: inventoryStatus(listing),
      listingType:
        listing.listingType === "RENT" || listing.listingType === "OFF_PLAN"
          ? listing.listingType
          : "SALE",
      amenities,
    };

    const list = byFloor.get(floor) ?? [];
    list.push(unit);
    byFloor.set(floor, list);
  }

  const floors = [...byFloor.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([level, units]) => ({
      level,
      label: undefined,
      units: units.sort((a, b) => a.unitLabel.localeCompare(b.unitLabel)),
    }));

  return {
    id: project.id,
    name: pickLocalized(project.title, locale) || project.id,
    subCity: project.subCity?.code ?? "—",
    addressLine: project.addressLine ?? undefined,
    developerName,
    floors,
  };
}

export function projectWalkthroughMeta(project: Project): WalkthroughBag {
  return asRecord(project.virtualWalkthroughConfig);
}
