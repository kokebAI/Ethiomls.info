import { NextRequest, NextResponse } from "next/server";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { hardDeleteScrapedListing } from "@/lib/imports/delete-scrape-data";

export const runtime = "nodejs";

/**
 * POST /api/scrape/discard
 * Body: `{ listingId: string }` — permanently delete scraped listing data.
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

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true },
  });
  if (!listing) {
    return NextResponse.json(
      { error: "NotFound", message: "Listing not found" },
      { status: 404 },
    );
  }

  try {
    await hardDeleteScrapedListing(listingId);
    return NextResponse.json({
      data: { id: listingId, deleted: true },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not delete listing";
    return NextResponse.json(
      { error: "DeleteFailed", message },
      { status: 500 },
    );
  }
}
