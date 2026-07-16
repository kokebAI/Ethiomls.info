import { ListingStatus } from "@prisma/client";

/**
 * Product-facing property lifecycle names used by comms / broadcast engines.
 * ACTIVE maps onto Prisma `ListingStatus.PUBLISHED`.
 */
export enum PropertyStatus {
  ACTIVE = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
  PENDING_REVIEW = "PENDING_REVIEW",
  DRAFT = "DRAFT",
}

export function toListingStatus(status: PropertyStatus): ListingStatus {
  return status as unknown as ListingStatus;
}

export function isActiveListingStatus(status: ListingStatus): boolean {
  return status === ListingStatus.PUBLISHED;
}

export const STALE_LISTING_DAYS = 30;
export const EXPIRY_REMINDER_LEAD_DAYS = 5;
