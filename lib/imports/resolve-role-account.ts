import { createHash } from "node:crypto";
import {
  UserRole,
  type DelalaProfile,
  type DeveloperProfile,
  type User,
} from "@prisma/client";
import { normalizeEthiopiaPhone } from "@/lib/auth/otp";
import { prisma } from "@/lib/db/prisma";

/** Non-login stub until the role user sets a password via reset SMS. */
export const ROLE_IMPORT_PASSWORD_HASH =
  "scrape-import:disabled:" +
  createHash("sha256").update("ethiomls-role-import-v1").digest("hex");

export type RoleAccountKind =
  | "CORPORATE_DEVELOPER"
  | "INDEPENDENT_DELALA"
  | "PROPERTY_OWNER";

/** Roles that can be created from Import sources (not owners). */
export type CreatableRoleAccountKind =
  | "CORPORATE_DEVELOPER"
  | "INDEPENDENT_DELALA";

export type RoleAccountSummary = {
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  role: RoleAccountKind;
  label: string;
  registrationNumber: string | null;
  tradeName: string | null;
  isVerified: boolean;
  listingCount: number;
  developerId: string | null;
  delalaId: string | null;
};

type UserWithProfiles = User & {
  developerProfile: DeveloperProfile | null;
  delalaProfile: DelalaProfile | null;
  _count: { listings: number };
};

function toSummary(user: UserWithProfiles): RoleAccountSummary | null {
  if (
    user.role !== UserRole.CORPORATE_DEVELOPER &&
    user.role !== UserRole.INDEPENDENT_DELALA &&
    user.role !== UserRole.PROPERTY_OWNER
  ) {
    return null;
  }
  const role = user.role as RoleAccountKind;
  const tradeName = user.developerProfile?.tradeName ?? null;
  const registrationNumber =
    user.developerProfile?.registrationNumber ?? null;
  const delalaName =
    user.delalaProfile?.displayName &&
    typeof user.delalaProfile.displayName === "object" &&
    user.delalaProfile.displayName !== null &&
    "en" in (user.delalaProfile.displayName as object)
      ? String(
          (user.delalaProfile.displayName as { en?: string }).en ?? "",
        ).trim()
      : null;

  const label =
    tradeName ||
    delalaName ||
    user.fullName ||
    user.phone ||
    user.email ||
    user.id;

  return {
    userId: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role,
    label,
    registrationNumber,
    tradeName,
    isVerified:
      user.developerProfile?.isVerified ??
      user.delalaProfile?.isVerified ??
      false,
    listingCount: user._count.listings,
    developerId: user.developerProfile?.id ?? null,
    delalaId: user.delalaProfile?.id ?? null,
  };
}

export async function listRoleAccounts(opts?: {
  includeOwners?: boolean;
}): Promise<RoleAccountSummary[]> {
  const roles: UserRole[] = [
    UserRole.CORPORATE_DEVELOPER,
    UserRole.INDEPENDENT_DELALA,
  ];
  if (opts?.includeOwners) {
    roles.push(UserRole.PROPERTY_OWNER);
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: roles },
    },
    include: {
      developerProfile: true,
      delalaProfile: true,
      _count: { select: { listings: true } },
    },
    orderBy: { fullName: "asc" },
    take: 300,
  });

  return users
    .map((user) => toSummary(user))
    .filter((row): row is RoleAccountSummary => row !== null);
}

export async function resolveOrCreateRoleAccount(input: {
  userId?: string;
  role: CreatableRoleAccountKind;
  phone?: string;
  fullName?: string;
  tradeName?: string;
  registrationNumber?: string;
  website?: string | null;
}): Promise<{
  account: RoleAccountSummary;
  created: boolean;
}> {
  if (input.userId) {
    const existing = await prisma.user.findFirst({
      where: {
        id: input.userId,
        isActive: true,
        role: {
          in: [UserRole.CORPORATE_DEVELOPER, UserRole.INDEPENDENT_DELALA],
        },
      },
      include: {
        developerProfile: true,
        delalaProfile: true,
        _count: { select: { listings: true } },
      },
    });
    const summary = existing ? toSummary(existing) : null;
    if (!summary) throw new Error("Role account not found");
    return { account: summary, created: false };
  }

  const phone = input.phone
    ? normalizeEthiopiaPhone(input.phone)
    : null;
  if (!phone) {
    throw new Error("Provide a valid Ethiopian mobile (+2519… / 09…) for the account");
  }

  const fullName =
    input.fullName?.trim() ||
    input.tradeName?.trim() ||
    "Imported account";
  const tradeName =
    input.tradeName?.trim() ||
    fullName ||
    "Imported developer";

  const byPhone = await prisma.user.findUnique({
    where: { phone },
    include: {
      developerProfile: true,
      delalaProfile: true,
      _count: { select: { listings: true } },
    },
  });

  if (byPhone) {
    if (
      byPhone.role !== UserRole.CORPORATE_DEVELOPER &&
      byPhone.role !== UserRole.INDEPENDENT_DELALA
    ) {
      throw new Error(
        `Phone ${phone} is already registered as ${byPhone.role}. Pick another phone or that user.`,
      );
    }
    // Ensure profile exists for the role
    if (
      byPhone.role === UserRole.CORPORATE_DEVELOPER &&
      !byPhone.developerProfile
    ) {
      const reg =
        input.registrationNumber?.trim() ||
        `ET-KIT-${phone.replace(/\D/g, "").slice(-8)}`;
      await prisma.developerProfile.create({
        data: {
          userId: byPhone.id,
          tradeName,
          displayName: { en: tradeName, am: tradeName },
          registrationNumber: reg,
          website: input.website ?? null,
        },
      });
    }
    if (
      byPhone.role === UserRole.INDEPENDENT_DELALA &&
      !byPhone.delalaProfile
    ) {
      await prisma.delalaProfile.create({
        data: {
          userId: byPhone.id,
          displayName: { en: fullName, am: fullName },
        },
      });
    }
    const refreshed = await prisma.user.findUniqueOrThrow({
      where: { id: byPhone.id },
      include: {
        developerProfile: true,
        delalaProfile: true,
        _count: { select: { listings: true } },
      },
    });
    const summary = toSummary(refreshed);
    if (!summary) throw new Error("Could not resolve role account");
    return { account: summary, created: false };
  }

  if (input.role === UserRole.CORPORATE_DEVELOPER) {
    const registrationNumber =
      input.registrationNumber?.trim() ||
      `ET-KIT-${phone.replace(/\D/g, "").slice(-8)}`;

    const clash = await prisma.developerProfile.findUnique({
      where: { registrationNumber },
      select: { id: true },
    });
    if (clash) {
      throw new Error(
        `Registration ${registrationNumber} is already used. Enter a different number.`,
      );
    }

    const user = await prisma.user.create({
      data: {
        phone,
        fullName,
        passwordHash: ROLE_IMPORT_PASSWORD_HASH,
        role: UserRole.CORPORATE_DEVELOPER,
        localePrefs: ["am", "en"],
        developerProfile: {
          create: {
            tradeName,
            displayName: { en: tradeName, am: tradeName },
            registrationNumber,
            website: input.website ?? null,
            isVerified: false,
          },
        },
      },
      include: {
        developerProfile: true,
        delalaProfile: true,
        _count: { select: { listings: true } },
      },
    });
    const summary = toSummary(user);
    if (!summary) throw new Error("Failed to create developer account");
    return { account: summary, created: true };
  }

  const user = await prisma.user.create({
    data: {
      phone,
      fullName,
      passwordHash: ROLE_IMPORT_PASSWORD_HASH,
      role: UserRole.INDEPENDENT_DELALA,
      localePrefs: ["am", "en"],
      delalaProfile: {
        create: {
          displayName: { en: fullName, am: fullName },
          isVerified: false,
        },
      },
    },
    include: {
      developerProfile: true,
      delalaProfile: true,
      _count: { select: { listings: true } },
    },
  });
  const summary = toSummary(user);
  if (!summary) throw new Error("Failed to create broker account");
  return { account: summary, created: true };
}
