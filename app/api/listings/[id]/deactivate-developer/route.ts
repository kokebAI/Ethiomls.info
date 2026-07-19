import { NextRequest, NextResponse } from "next/server";
import { ListingStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export const DEVELOPER_DEACTIVATE_REASONS = [
  "FRAUDULENT_PROFILE",
  "UNLICENSED_OR_UNAUTHORIZED",
  "REPEATED_NONCOMPLIANT_LISTINGS",
  "DUPLICATE_ACCOUNT",
  "OWNER_REQUESTED_REMOVAL",
  "POLICY_VIOLATION",
] as const;

const REASON_LABELS: Record<(typeof DEVELOPER_DEACTIVATE_REASONS)[number], string> =
  {
    FRAUDULENT_PROFILE: "Fraudulent or fake developer profile",
    UNLICENSED_OR_UNAUTHORIZED: "Unlicensed or unauthorized to list",
    REPEATED_NONCOMPLIANT_LISTINGS: "Repeated incomplete or non-compliant listings",
    DUPLICATE_ACCOUNT: "Duplicate developer account",
    OWNER_REQUESTED_REMOVAL: "Developer requested account removal",
    POLICY_VIOLATION: "Other EthioMLS policy violation",
  };

const bodySchema = z.object({
  reason: z.enum(DEVELOPER_DEACTIVATE_REASONS),
  /** Optional explicit user id; otherwise resolve from listing developer / owner. */
  userId: z.string().min(1).optional(),
});

/**
 * POST /api/listings/[id]/deactivate-developer
 * Admin: deactivate the attached developer account and send this listing to draft.
 */
export async function POST(
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
        message: "Choose a deactivation reason from the list",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const listing = await prisma.listing.findUnique({
    where: { id: id.trim() },
    select: {
      id: true,
      status: true,
      ownerId: true,
      developerId: true,
      owner: {
        select: { id: true, role: true, fullName: true, isActive: true },
      },
      developer: {
        select: {
          id: true,
          tradeName: true,
          userId: true,
          user: { select: { id: true, fullName: true, isActive: true, role: true } },
        },
      },
    },
  });

  if (!listing) {
    return NextResponse.json(
      { error: "NotFound", message: "Listing not found" },
      { status: 404 },
    );
  }

  if (listing.status === ListingStatus.PUBLISHED) {
    return NextResponse.json(
      {
        error: "AlreadyPublished",
        message: "Unpublish before deactivating the developer on this listing",
      },
      { status: 409 },
    );
  }

  let targetUserId = parsed.data.userId ?? null;
  let targetLabel = "developer";

  if (!targetUserId && listing.developer?.user) {
    targetUserId = listing.developer.user.id;
    targetLabel =
      listing.developer.tradeName || listing.developer.user.fullName;
  } else if (
    !targetUserId &&
    listing.owner.role === UserRole.CORPORATE_DEVELOPER
  ) {
    targetUserId = listing.owner.id;
    targetLabel = listing.owner.fullName;
  }

  if (!targetUserId) {
    return NextResponse.json(
      {
        error: "NoDeveloper",
        message:
          "No developer is attached to this listing. Attach a developer first, or reject the listing to draft.",
      },
      { status: 400 },
    );
  }

  const target = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      role: UserRole.CORPORATE_DEVELOPER,
    },
    select: {
      id: true,
      fullName: true,
      isActive: true,
      developerProfile: { select: { tradeName: true } },
    },
  });

  if (!target) {
    return NextResponse.json(
      {
        error: "NotFound",
        message: "Developer account not found for this listing",
      },
      { status: 404 },
    );
  }

  const reasonCode = parsed.data.reason;
  const reasonLabel = REASON_LABELS[reasonCode];
  const notes = `Developer deactivated: ${reasonLabel}`;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: target.id },
      data: { isActive: false },
      select: { id: true, fullName: true, isActive: true },
    });

    const updatedListing = await tx.listing.update({
      where: { id: listing.id },
      data: {
        status: ListingStatus.DRAFT,
        publishedAt: null,
        adminAuditApprovedAt: null,
        adminAuditedById: admin.id,
        adminAuditNotes: notes,
        developerId: null,
      },
      select: {
        id: true,
        status: true,
        ownerId: true,
        developerId: true,
      },
    });

    await tx.adminAlert.create({
      data: {
        type: "DEVELOPER_DEACTIVATED",
        severity: "WARNING",
        title: "Developer deactivated from audit",
        message: `${target.developerProfile?.tradeName || target.fullName} deactivated. Listing ${listing.id} moved to draft. Reason: ${reasonLabel}`,
        listingId: listing.id,
        payload: {
          reasonCode,
          reasonLabel,
          deactivatedUserId: target.id,
          listingId: listing.id,
          adminId: admin.id,
        },
      },
    });

    return { user, listing: updatedListing };
  });

  return NextResponse.json({
    ok: true,
    data: {
      listingId: result.listing.id,
      status: result.listing.status,
      deactivatedUserId: result.user.id,
      deactivatedName: targetLabel,
      reason: reasonCode,
      reasonLabel,
    },
    message: `Developer deactivated and listing ${listing.id} moved to draft.`,
  });
}
