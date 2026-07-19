import { NotificationStatus, ListingStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * POST /api/scrape/discard
 * Body: `{ listingId: string }` — mark scraped listing as junk (DISCARDED + ARCHIVED).
 */
export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
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

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, notificationStatus: true },
  });
  if (!listing) {
    return NextResponse.json(
      { error: "NotFound", message: "Listing not found" },
      { status: 404 },
    );
  }

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: {
      notificationStatus: NotificationStatus.DISCARDED,
      status: ListingStatus.ARCHIVED,
      publishedAt: null,
      notificationError: "Discarded by admin as spam/junk",
      adminAuditNotes: `Discarded by admin ${admin.id} at ${new Date().toISOString()}`,
    },
    select: {
      id: true,
      notificationStatus: true,
      status: true,
    },
  });

  return NextResponse.json({ data: updated });
}
