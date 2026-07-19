import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sendScrapeInvite } from "@/lib/imports/scrape-invite";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/scrape/send-invite
 * Body: `{ listingId: string }` — admin Edit & Send → HaHu dispatch.
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

  const exists = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json(
      { error: "NotFound", message: "Listing not found" },
      { status: 404 },
    );
  }

  try {
    const result = await sendScrapeInvite(listingId);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "SendFailed",
          message: result.error ?? "HaHu invite failed",
          data: {
            listingId,
            notificationStatus: result.listing.notificationStatus,
            messagePreview: result.messagePreview,
            account: result.account ?? null,
            accountCreated: result.accountCreated ?? false,
          },
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      data: {
        listingId,
        notificationStatus: result.listing.notificationStatus,
        messagePreview: result.messagePreview,
        account: result.account
          ? {
              userId: result.account.userId,
              role: result.account.role,
              label: result.account.label,
              phone: result.account.phone,
              developerId: result.account.developerId,
              delalaId: result.account.delalaId,
            }
          : null,
        accountCreated: Boolean(result.accountCreated),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Send invite failed";
    return NextResponse.json(
      { error: "SendFailed", message },
      { status: 502 },
    );
  }
}
