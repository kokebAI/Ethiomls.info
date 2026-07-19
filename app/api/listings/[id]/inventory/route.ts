import { InventoryStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { getSession } from "@/lib/auth/session";
import {
  inventoryStatusSideEffects,
  mergeInventoryMetadataTags,
} from "@/lib/catalog/inventory-status";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  inventoryStatus: z.nativeEnum(InventoryStatus),
});

/**
 * PATCH /api/listings/[id]/inventory
 * Updates unit stock (Available / Reserved / Sold) without changing publish status.
 * Allowed: admin, listing owner, or the attached developer account.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sign in required" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  if (!id?.trim()) {
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "inventoryStatus must be AVAILABLE, RESERVED, or SOLD",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      developerId: true,
      metadataTags: true,
      virtualWalkthroughConfig: true,
      developer: { select: { userId: true } },
    },
  });

  if (!listing) {
    return NextResponse.json(
      { error: "NotFound", message: "Listing not found" },
      { status: 404 },
    );
  }

  const admin = await getCurrentAdmin();
  const isOwner = listing.ownerId === session.userId;
  const isDeveloper = listing.developer?.userId === session.userId;
  if (!admin && !isOwner && !isDeveloper) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: "Only the owner, attached developer, or an admin can update inventory",
      },
      { status: 403 },
    );
  }

  // Soft role guard for non-admins: owners who are buyers shouldn't mass-edit
  // via this path unless they own the listing (already checked).
  if (!admin && session.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, isActive: true },
    });
    if (!user?.isActive) {
      return NextResponse.json(
        { error: "Forbidden", message: "Inactive account" },
        { status: 403 },
      );
    }
    if (
      !isOwner &&
      !isDeveloper &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.CORPORATE_DEVELOPER
    ) {
      return NextResponse.json(
        { error: "Forbidden", message: "Developer access required" },
        { status: 403 },
      );
    }
  }

  const status = parsed.data.inventoryStatus;
  const side = inventoryStatusSideEffects(status);
  const prevConfig =
    listing.virtualWalkthroughConfig &&
    typeof listing.virtualWalkthroughConfig === "object" &&
    !Array.isArray(listing.virtualWalkthroughConfig)
      ? (listing.virtualWalkthroughConfig as Record<string, unknown>)
      : {};

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      inventoryStatus: status,
      metadataTags: mergeInventoryMetadataTags(listing.metadataTags, status),
      virtualWalkthroughConfig: {
        ...prevConfig,
        inventoryStatus: side.inventoryStatusKey,
      },
    },
    select: {
      id: true,
      inventoryStatus: true,
      status: true,
    },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      inventoryStatus: updated.inventoryStatus,
      publicationStatus: updated.status,
    },
  });
}
