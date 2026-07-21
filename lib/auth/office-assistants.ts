import { UserRole } from "@prisma/client";
import { normalizeEthiopiaPhone } from "@/lib/auth/otp";
import { prisma } from "@/lib/db/prisma";
import { ROLE_IMPORT_PASSWORD_HASH } from "@/lib/imports/resolve-role-account";

export type OfficeAssistantSummary = {
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
};

export async function listOfficeAssistants(): Promise<OfficeAssistantSummary[]> {
  const users = await prisma.user.findMany({
    where: { role: UserRole.OFFICE_ASSISTANT },
    orderBy: { fullName: "asc" },
    take: 200,
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
  });

  return users.map((user) => ({
    userId: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  }));
}

/**
 * Create or promote a user to OFFICE_ASSISTANT by Ethiopian mobile.
 * Existing ADMIN cannot be demoted. Claim login via Reset password SMS.
 */
export async function resolveOrCreateOfficeAssistant(input: {
  phone: string;
  fullName?: string;
}): Promise<{ assistant: OfficeAssistantSummary; created: boolean; promoted: boolean }> {
  const phone = normalizeEthiopiaPhone(input.phone);
  if (!phone) {
    throw new Error(
      "Provide a valid Ethiopian mobile (+2519… / 09…) for the office assistant",
    );
  }

  const fullName = input.fullName?.trim() || "Office assistant";
  const existing = await prisma.user.findUnique({ where: { phone } });

  if (existing) {
    if (existing.role === UserRole.ADMIN) {
      throw new Error("That phone belongs to a full admin — demote them first");
    }
    if (existing.role === UserRole.OFFICE_ASSISTANT) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          ...(input.fullName?.trim()
            ? { fullName: input.fullName.trim() }
            : {}),
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          isActive: true,
          createdAt: true,
        },
      });
      return {
        assistant: {
          userId: updated.id,
          fullName: updated.fullName,
          phone: updated.phone,
          email: updated.email,
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
        },
        created: false,
        promoted: false,
      };
    }

    const promoted = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: UserRole.OFFICE_ASSISTANT,
        isActive: true,
        fullName: input.fullName?.trim() || existing.fullName,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      assistant: {
        userId: promoted.id,
        fullName: promoted.fullName,
        phone: promoted.phone,
        email: promoted.email,
        isActive: promoted.isActive,
        createdAt: promoted.createdAt.toISOString(),
      },
      created: false,
      promoted: true,
    };
  }

  const created = await prisma.user.create({
    data: {
      phone,
      fullName,
      passwordHash: ROLE_IMPORT_PASSWORD_HASH,
      role: UserRole.OFFICE_ASSISTANT,
      localePrefs: ["am", "en"],
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
  });

  return {
    assistant: {
      userId: created.id,
      fullName: created.fullName,
      phone: created.phone,
      email: created.email,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
    },
    created: true,
    promoted: false,
  };
}

export async function setOfficeAssistantActive(input: {
  userId: string;
  isActive: boolean;
}): Promise<OfficeAssistantSummary> {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, role: UserRole.OFFICE_ASSISTANT },
  });
  if (!user) throw new Error("Office assistant not found");

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isActive: input.isActive },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
  });

  return {
    userId: updated.id,
    fullName: updated.fullName,
    phone: updated.phone,
    email: updated.email,
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
  };
}
