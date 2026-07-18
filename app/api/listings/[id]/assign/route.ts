import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const assignSchema = z.object({
  userId: z.string().min(1),
});

/**
 * PATCH /api/listings/[id]/assign
 * Admin: attach a listing to a developer / broker / owner account.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { error: "ValidationError", message: "Listing id required" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "InvalidJson", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Provide userId of the account to attach",
      },
      { status: 400 },
    );
  }

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!listing) {
    return NextResponse.json(
      { error: "NotFound", message: "Listing not found" },
      { status: 404 },
    );
  }

  const account = await prisma.user.findFirst({
    where: {
      id: parsed.data.userId,
      isActive: true,
      role: {
        in: [
          UserRole.CORPORATE_DEVELOPER,
          UserRole.INDEPENDENT_DELALA,
          UserRole.PROPERTY_OWNER,
        ],
      },
    },
    select: {
      id: true,
      fullName: true,
      role: true,
      phone: true,
      developerProfile: { select: { id: true, tradeName: true } },
      delalaProfile: { select: { id: true } },
    },
  });

  if (!account) {
    return NextResponse.json(
      {
        error: "NotFound",
        message: "Active developer, broker, or owner account not found",
      },
      { status: 404 },
    );
  }

  let developerId: string | null = null;
  let delalaId: string | null = null;

  if (account.role === UserRole.CORPORATE_DEVELOPER) {
    if (!account.developerProfile) {
      return NextResponse.json(
        {
          error: "ProfileMissing",
          message:
            "That developer has no profile yet. Create one from Import sources first.",
        },
        { status: 400 },
      );
    }
    developerId = account.developerProfile.id;
  } else if (account.role === UserRole.INDEPENDENT_DELALA) {
    if (!account.delalaProfile) {
      return NextResponse.json(
        {
          error: "ProfileMissing",
          message:
            "That broker has no profile yet. Create one from Import sources first.",
        },
        { status: 400 },
      );
    }
    delalaId = account.delalaProfile.id;
  }

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      ownerId: account.id,
      developerId,
      delalaId,
      contactName: account.fullName,
      contactPhone: account.phone,
    },
    select: {
      id: true,
      ownerId: true,
      developerId: true,
      delalaId: true,
      owner: { select: { fullName: true, role: true, phone: true } },
      developer: { select: { tradeName: true } },
      delala: { select: { displayName: true } },
    },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      ownerId: updated.ownerId,
      developerId: updated.developerId,
      delalaId: updated.delalaId,
      ownerName: updated.owner.fullName,
      ownerRole: updated.owner.role,
      ownerPhone: updated.owner.phone,
      developerTradeName: updated.developer?.tradeName ?? null,
      delalaDisplayName:
        updated.delala?.displayName &&
        typeof updated.delala.displayName === "object" &&
        updated.delala.displayName !== null &&
        "en" in updated.delala.displayName
          ? String(
              (updated.delala.displayName as { en?: string }).en ?? "",
            ).trim() || null
          : null,
    },
  });
}
