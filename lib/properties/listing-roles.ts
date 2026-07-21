import { ListingType, UserRole } from "@prisma/client";

/** Roles that may create marketplace listings. */
export const LISTING_CREATOR_ROLES: UserRole[] = [
  UserRole.PROPERTY_OWNER,
  UserRole.INDEPENDENT_DELALA,
  UserRole.CORPORATE_DEVELOPER,
  UserRole.OFFICE_ASSISTANT,
  UserRole.ADMIN,
];

export function canCreateListings(
  role: string | UserRole | null | undefined,
): boolean {
  return LISTING_CREATOR_ROLES.includes(role as UserRole);
}

/**
 * Off-plan unfinished inventory (full pack) is developer-only.
 * Owners and brokers use SALE / RENT with the same lighter criteria.
 * Admins and office assistants may submit OFF_PLAN for ops/testing.
 */
export function canSubmitOffPlan(
  role: string | UserRole | null | undefined,
): boolean {
  return (
    role === UserRole.CORPORATE_DEVELOPER ||
    role === "CORPORATE_DEVELOPER" ||
    role === UserRole.OFFICE_ASSISTANT ||
    role === "OFFICE_ASSISTANT" ||
    role === UserRole.ADMIN ||
    role === "ADMIN"
  );
}

export function assertListingCreateAllowed(input: {
  role: string | UserRole;
  listingType: ListingType | string;
}): void {
  if (!canCreateListings(input.role)) {
    throw Object.assign(
      new Error("Clients cannot publish listings — browse and enquire only"),
      { code: "role_cannot_list" },
    );
  }
  if (
    input.listingType === ListingType.OFF_PLAN ||
    input.listingType === "OFF_PLAN"
  ) {
    if (!canSubmitOffPlan(input.role)) {
      throw Object.assign(
        new Error(
          "Off-plan inventory is for developers only. Owners and brokers list SALE or RENT.",
        ),
        { code: "off_plan_role_forbidden" },
      );
    }
  }
}
