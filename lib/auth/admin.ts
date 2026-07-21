import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export type StaffUser = {
  id: string;
  fullName: string;
  role: UserRole;
};

/** Roles that may run imports, scrapes, and create listing ops data. */
export const OPS_STAFF_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.OFFICE_ASSISTANT,
];

export function isFullAdminRole(
  role: string | UserRole | null | undefined,
): boolean {
  return role === UserRole.ADMIN || role === "ADMIN";
}

export function isOpsStaffRole(
  role: string | UserRole | null | undefined,
): boolean {
  return (
    role === UserRole.ADMIN ||
    role === "ADMIN" ||
    role === UserRole.OFFICE_ASSISTANT ||
    role === "OFFICE_ASSISTANT"
  );
}

/** Resolve the current active admin from the signed session cookie. */
export async function getCurrentAdmin(): Promise<StaffUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      role: UserRole.ADMIN,
      isActive: true,
    },
    select: { id: true, fullName: true, role: true },
  });
  return user;
}

/**
 * Full admin or office assistant — imports, scrape review, listing create.
 * Does not grant audit / publish / staff provisioning.
 */
export async function getCurrentOpsStaff(): Promise<StaffUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      role: { in: OPS_STAFF_ROLES },
      isActive: true,
    },
    select: { id: true, fullName: true, role: true },
  });
  return user;
}
