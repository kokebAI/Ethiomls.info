import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hubPathForRole } from "@/lib/roles/hubs";

/** Roles that may browse the public home / listings / projects catalogs. */
export function isClientCatalogRole(
  role: string | UserRole | null | undefined,
): boolean {
  return role === UserRole.BUYER_RENTER || role === "BUYER_RENTER";
}

/**
 * If the signed-in user is not a client, return their hub path (with locale)
 * so catalog pages can redirect. Guests and clients return null.
 */
export async function nonClientCatalogRedirect(
  locale: string,
): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    select: { role: true },
  });
  if (!user || isClientCatalogRole(user.role)) return null;

  return `/${locale}${hubPathForRole(user.role)}`;
}
