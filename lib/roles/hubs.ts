import { UserRole } from "@prisma/client";

/** Hub slug used in `/[locale]/roles/[slug]`. */
export type RoleHubSlug =
  | "client"
  | "broker"
  | "owner"
  | "developer"
  | "assistant"
  | "admin";

export type RoleHubCta = {
  /** i18n key under roles.<slug>.ctas.<id> for the button label */
  id: string;
  href: string;
  /** Primary filled button vs outline */
  primary?: boolean;
};

export type RoleHubDef = {
  slug: RoleHubSlug;
  role: UserRole;
  ctas: RoleHubCta[];
};

export const ROLE_HUBS: Record<RoleHubSlug, RoleHubDef> = {
  client: {
    slug: "client",
    role: UserRole.BUYER_RENTER,
    ctas: [
      { id: "browse", href: "/listings", primary: true },
      { id: "projects", href: "/projects" },
      { id: "guide", href: "/" },
      { id: "profile", href: "/profile" },
    ],
  },
  broker: {
    slug: "broker",
    role: UserRole.INDEPENDENT_DELALA,
    ctas: [
      { id: "list", href: "/listings/new", primary: true },
      { id: "profile", href: "/profile" },
      { id: "dashboard", href: "/dashboard" },
    ],
  },
  owner: {
    slug: "owner",
    role: UserRole.PROPERTY_OWNER,
    ctas: [
      { id: "list", href: "/listings/new", primary: true },
      { id: "profile", href: "/profile" },
    ],
  },
  developer: {
    slug: "developer",
    role: UserRole.CORPORATE_DEVELOPER,
    ctas: [
      { id: "workspace", href: "/workspace/developer", primary: true },
      { id: "list", href: "/listings/new?type=OFF_PLAN" },
      { id: "myPage", href: "/developers" },
      { id: "profile", href: "/profile" },
    ],
  },
  assistant: {
    slug: "assistant",
    role: UserRole.OFFICE_ASSISTANT,
    ctas: [
      { id: "audit", href: "/admin/audit", primary: true },
      { id: "imports", href: "/admin/imports" },
      { id: "scrapeReview", href: "/admin/scrape-review" },
      { id: "addListing", href: "/listings/new" },
      { id: "profile", href: "/profile" },
    ],
  },
  admin: {
    slug: "admin",
    role: UserRole.ADMIN,
    ctas: [
      { id: "workspace", href: "/workspace/admin", primary: true },
      { id: "audit", href: "/admin/audit" },
      { id: "assistants", href: "/workspace/admin#staff" },
      { id: "addListing", href: "/listings/new" },
      { id: "imports", href: "/admin/imports" },
      { id: "scrapeReview", href: "/admin/scrape-review" },
      { id: "profile", href: "/profile" },
    ],
  },
};

export const ROLE_HUB_SLUGS = Object.keys(ROLE_HUBS) as RoleHubSlug[];

export function isRoleHubSlug(value: string): value is RoleHubSlug {
  return value in ROLE_HUBS;
}

/** Path to the curated hub for a Prisma role (locale prefix applied by caller). */
export function hubPathForRole(role: string | UserRole | null | undefined): string {
  switch (role) {
    case UserRole.ADMIN:
    case "ADMIN":
      return "/workspace/admin";
    case UserRole.OFFICE_ASSISTANT:
    case "OFFICE_ASSISTANT":
      return "/admin/audit";
    case UserRole.INDEPENDENT_DELALA:
    case "INDEPENDENT_DELALA":
      return "/roles/broker";
    case UserRole.PROPERTY_OWNER:
    case "PROPERTY_OWNER":
      return "/roles/owner";
    case UserRole.CORPORATE_DEVELOPER:
    case "CORPORATE_DEVELOPER":
      return "/workspace/developer";
    case UserRole.BUYER_RENTER:
    case "BUYER_RENTER":
    default:
      return "/roles/client";
  }
}

export function hubDefForRole(
  role: string | UserRole | null | undefined,
): RoleHubDef {
  switch (role) {
    case UserRole.ADMIN:
    case "ADMIN":
      return ROLE_HUBS.admin;
    case UserRole.OFFICE_ASSISTANT:
    case "OFFICE_ASSISTANT":
      return ROLE_HUBS.assistant;
    case UserRole.INDEPENDENT_DELALA:
    case "INDEPENDENT_DELALA":
      return ROLE_HUBS.broker;
    case UserRole.PROPERTY_OWNER:
    case "PROPERTY_OWNER":
      return ROLE_HUBS.owner;
    case UserRole.CORPORATE_DEVELOPER:
    case "CORPORATE_DEVELOPER":
      return ROLE_HUBS.developer;
    case UserRole.BUYER_RENTER:
    case "BUYER_RENTER":
    default:
      return ROLE_HUBS.client;
  }
}
