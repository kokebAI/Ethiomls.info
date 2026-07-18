import { UserRole } from "@prisma/client";

/** Hub slug used in `/[locale]/roles/[slug]`. */
export type RoleHubSlug =
  | "client"
  | "broker"
  | "owner"
  | "developer"
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
  /** Demo phone shown on login (local format) */
  demoPhone: string;
  ctas: RoleHubCta[];
};

export const ROLE_HUBS: Record<RoleHubSlug, RoleHubDef> = {
  client: {
    slug: "client",
    role: UserRole.BUYER_RENTER,
    demoPhone: "0911000002",
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
    demoPhone: "0911000003",
    ctas: [
      { id: "list", href: "/listings/new", primary: true },
      { id: "browse", href: "/listings" },
      { id: "profile", href: "/profile" },
      { id: "dashboard", href: "/dashboard" },
    ],
  },
  owner: {
    slug: "owner",
    role: UserRole.PROPERTY_OWNER,
    demoPhone: "0911000004",
    ctas: [
      { id: "list", href: "/listings/new", primary: true },
      { id: "browse", href: "/listings" },
      { id: "profile", href: "/profile" },
      { id: "guide", href: "/" },
    ],
  },
  developer: {
    slug: "developer",
    role: UserRole.CORPORATE_DEVELOPER,
    demoPhone: "0911000005",
    ctas: [
      { id: "list", href: "/listings/new?type=OFF_PLAN", primary: true },
      { id: "projects", href: "/projects" },
      { id: "myPage", href: "/developers" },
      { id: "profile", href: "/profile" },
    ],
  },
  admin: {
    slug: "admin",
    role: UserRole.ADMIN,
    demoPhone: "0911000001",
    ctas: [
      { id: "imports", href: "/admin/imports", primary: true },
      { id: "dashboard", href: "/dashboard" },
      { id: "listings", href: "/listings" },
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
      return "/roles/admin";
    case UserRole.INDEPENDENT_DELALA:
    case "INDEPENDENT_DELALA":
      return "/roles/broker";
    case UserRole.PROPERTY_OWNER:
    case "PROPERTY_OWNER":
      return "/roles/owner";
    case UserRole.CORPORATE_DEVELOPER:
    case "CORPORATE_DEVELOPER":
      return "/roles/developer";
    case UserRole.BUYER_RENTER:
    case "BUYER_RENTER":
    default:
      return "/roles/client";
  }
}

export function hubDefForRole(
  role: string | UserRole | null | undefined,
): RoleHubDef {
  const path = hubPathForRole(role);
  const slug = path.replace("/roles/", "") as RoleHubSlug;
  return ROLE_HUBS[slug] ?? ROLE_HUBS.client;
}
