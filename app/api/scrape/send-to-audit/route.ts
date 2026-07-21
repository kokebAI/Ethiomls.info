import { NextRequest, NextResponse } from "next/server";
import { ListingStatus, NotificationStatus, Prisma } from "@prisma/client";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import { ensureInvitePartyAttached } from "@/lib/imports/scrape-invite";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * POST /api/scrape/send-to-audit
 * Body: `{ listingId }` — leave the invite queue and put the listing
 * into the admin pending-audit workspace (no HaHu SMS).
 */
export async function POST(request: NextRequest) {
  const admin = await getCurrentOpsStaff();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Staff access required" },
      { status: 403 },
    );
  }

  let listingId = "";
  try {
    const body = (await request.json()) as { listingId?: string; id?: string };
    listingId = (body.listingId ?? body.id ?? "").trim();
  } catch {
    return NextResponse.json(
      { error: "BadRequest", message: "JSON body with listingId required" },
      { status: 400 },
    );
  }

  if (!listingId) {
    return NextResponse.json(
      { error: "BadRequest", message: "listingId is required" },
      { status: 400 },
    );
  }

  const existing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, contactPhone: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "NotFound", message: "Listing not found" },
      { status: 404 },
    );
  }

  let accountLabel: string | null = null;
  try {
    if (existing.contactPhone?.trim()) {
      const attached = await ensureInvitePartyAttached(listingId);
      accountLabel = attached.account.label;
    }
  } catch (error) {
    console.warn("[scrape/send-to-audit] party attach skipped:", error);
  }

  const listing = await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: ListingStatus.PENDING_REVIEW,
      adminAuditApprovedAt: null,
      adminAuditedById: null,
      adminAuditNotes: null,
      adminAuditChecklist: Prisma.DbNull,
      notificationStatus: NotificationStatus.NOT_APPLICABLE,
      notificationError: null,
    },
    select: {
      id: true,
      status: true,
      notificationStatus: true,
    },
  });

  return NextResponse.json({
    data: {
      listingId: listing.id,
      status: listing.status,
      notificationStatus: listing.notificationStatus,
      accountLabel,
    },
  });
}
