import { UserRole } from "@prisma/client";

/**
 * Roles a user may pick at signup. Exactly one is stored on `User.role`.
 * ADMIN is never self-assignable.
 */
export const SIGNUP_ROLES = [
  UserRole.BUYER_RENTER,
  UserRole.PROPERTY_OWNER,
  UserRole.INDEPENDENT_DELALA,
  UserRole.CORPORATE_DEVELOPER,
] as const;

export type SignupRole = (typeof SIGNUP_ROLES)[number];

export const SIGNUP_ROLE_OPTIONS: Array<{
  role: SignupRole;
  /** i18n key for the option title */
  labelKey: string;
  /** i18n key for a short description */
  hintKey: string;
}> = [
  {
    role: UserRole.BUYER_RENTER,
    labelKey: "auth.role.client",
    hintKey: "auth.role.clientHint",
  },
  {
    role: UserRole.PROPERTY_OWNER,
    labelKey: "auth.role.owner",
    hintKey: "auth.role.ownerHint",
  },
  {
    role: UserRole.INDEPENDENT_DELALA,
    labelKey: "auth.role.broker",
    hintKey: "auth.role.brokerHint",
  },
  {
    role: UserRole.CORPORATE_DEVELOPER,
    labelKey: "auth.role.developer",
    hintKey: "auth.role.developerHint",
  },
];

export function isSignupRole(value: unknown): value is SignupRole {
  return (
    typeof value === "string" &&
    (SIGNUP_ROLES as readonly string[]).includes(value)
  );
}

/** Map Prisma role → i18n label key for profile display. */
export function roleLabelKey(role: string): string {
  switch (role) {
    case UserRole.BUYER_RENTER:
      return "auth.role.client";
    case UserRole.PROPERTY_OWNER:
      return "auth.role.owner";
    case UserRole.INDEPENDENT_DELALA:
      return "auth.role.broker";
    case UserRole.CORPORATE_DEVELOPER:
      return "auth.role.developer";
    case UserRole.ADMIN:
      return "auth.role.admin";
    default:
      return "auth.role.client";
  }
}
