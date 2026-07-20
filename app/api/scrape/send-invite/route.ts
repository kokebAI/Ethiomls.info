import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sendScrapeInviteForPhoneGroup } from "@/lib/imports/scrape-invite";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;

function parseListingIds(body: {
  listingId?: string;
  id?: string;
  listingIds?: string[];
  ids?: string[];
}): string[] {
  if (Array.isArray(body.listingIds) && body.listingIds.length > 0) {
    return body.listingIds.map((id) => String(id).trim()).filter(Boolean);
  }
  if (Array.isArray(body.ids) && body.ids.length > 0) {
    return body.ids.map((id) => String(id).trim()).filter(Boolean);
  }
  const single = (body.listingId ?? body.id ?? "").trim();
  return single ? [single] : [];
}

/**
 * POST /api/scrape/send-invite
 * Body: `{ listingId }` or `{ listingIds: string[] }` — admin invite → HaHu dispatch.
 */
export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
      { status: 403 },
    );
  }

  let listingIds: string[] = [];
  try {
    const body = (await request.json()) as {
      listingId?: string;
      id?: string;
      listingIds?: string[];
      ids?: string[];
    };
    listingIds = parseListingIds(body);
  } catch {
    return NextResponse.json(
      {
        error: "BadRequest",
        message: "JSON body with listingId or listingIds required",
      },
      { status: 400 },
    );
  }

  if (listingIds.length === 0) {
    return NextResponse.json(
      { error: "BadRequest", message: "listingId or listingIds is required" },
      { status: 400 },
    );
  }

  const exists = await prisma.listing.count({
    where: { id: { in: listingIds } },
  });
  if (exists !== listingIds.length) {
    return NextResponse.json(
      { error: "NotFound", message: "One or more listings were not found" },
      { status: 404 },
    );
  }

  try {
    const result = await sendScrapeInviteForPhoneGroup(listingIds);
    const account = result.account;
    const payload = {
      listingId: listingIds[0],
      listingIds,
      sentListingIds: result.sentListingIds,
      notificationStatus: result.listings[0]?.notificationStatus ?? null,
      messagePreview: result.messagePreview,
      account: account
        ? {
            userId: account.userId,
            role: account.role,
            label: account.label,
            phone: account.phone,
            developerId: account.developerId,
            delalaId: account.delalaId,
          }
        : null,
      accountCreated: Boolean(result.accountCreated),
    };

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "SendFailed",
          message: result.error ?? "HaHu invite failed",
          data: payload,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ data: payload });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Send invite failed";
    return NextResponse.json(
      { error: "SendFailed", message },
      { status: 502 },
    );
  }
}
