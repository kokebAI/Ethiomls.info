import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

/** Resolve the current active admin from the signed session cookie. */
export async function getCurrentAdmin() {
  const session = await getSession();
  if (!session) return null;

  return prisma.user.findFirst({
    where: {
      id: session.userId,
      role: UserRole.ADMIN,
      isActive: true,
    },
    select: { id: true, fullName: true },
  });
}
