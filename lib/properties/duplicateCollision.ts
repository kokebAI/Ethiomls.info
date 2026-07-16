import {
  ListingStatus,
  type Listing,
  type Prisma,
  type PropertyCategory,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AddisSubCityCode } from "@/lib/properties/subCities";

export const DUPLICATE_COLLISION_ALERT_TYPE = "DUPLICATE_LISTING_COLLISION";

export type DuplicateCollisionMatch = {
  id: string;
  status: ListingStatus;
  subCityId: string | null;
  priceAmount: Prisma.Decimal;
  bedrooms: number | null;
  category: PropertyCategory;
};

export type DuplicateCollisionResult = {
  collided: boolean;
  matches: DuplicateCollisionMatch[];
  flaggedListingIds: string[];
  alertId: string | null;
};

type CollisionProbe = {
  subCityId: string;
  subCityCode: AddisSubCityCode;
  price: number;
  bedrooms: number;
  propertyType: PropertyCategory;
  incomingOwnerId: string;
};

/**
 * Multi-attribute duplicate collision tracker.
 * Matches existing listings on subCity + price + bedrooms + propertyType.
 * Colliding listings are flagged PENDING_REVIEW and an admin dashboard alert is raised.
 */
export async function trackDuplicateCollisions(
  probe: CollisionProbe,
): Promise<DuplicateCollisionResult> {
  const matches = await prisma.listing.findMany({
    where: {
      subCityId: probe.subCityId,
      priceAmount: probe.price,
      bedrooms: probe.bedrooms,
      category: probe.propertyType,
      status: {
        notIn: [ListingStatus.ARCHIVED, ListingStatus.SOLD, ListingStatus.RENTED],
      },
    },
    select: {
      id: true,
      status: true,
      subCityId: true,
      priceAmount: true,
      bedrooms: true,
      category: true,
    },
  });

  if (matches.length === 0) {
    return {
      collided: false,
      matches: [],
      flaggedListingIds: [],
      alertId: null,
    };
  }

  const idsNeedingFlag = matches
    .filter((listing) => listing.status !== ListingStatus.PENDING_REVIEW)
    .map((listing) => listing.id);

  if (idsNeedingFlag.length > 0) {
    await prisma.listing.updateMany({
      where: { id: { in: idsNeedingFlag } },
      data: { status: ListingStatus.PENDING_REVIEW },
    });
  }

  const flaggedListingIds = matches.map((listing) => listing.id);

  const alert = await prisma.adminAlert.create({
    data: {
      type: DUPLICATE_COLLISION_ALERT_TYPE,
      severity: "WARNING",
      title: "Duplicate listing collision detected",
      message: `Incoming property collided with ${matches.length} existing listing(s) on subCity=${probe.subCityCode}, price=${probe.price}, bedrooms=${probe.bedrooms}, propertyType=${probe.propertyType}. Matched listings flagged PENDING_REVIEW.`,
      listingId: matches[0]?.id,
      payload: {
        subCity: probe.subCityCode,
        subCityId: probe.subCityId,
        price: probe.price,
        bedrooms: probe.bedrooms,
        propertyType: probe.propertyType,
        incomingOwnerId: probe.incomingOwnerId,
        matchedListingIds: flaggedListingIds,
        newlyFlaggedListingIds: idsNeedingFlag,
        detectedAt: new Date().toISOString(),
      },
    },
  });

  return {
    collided: true,
    matches,
    flaggedListingIds,
    alertId: alert.id,
  };
}

export type CreatedListing = Listing;
