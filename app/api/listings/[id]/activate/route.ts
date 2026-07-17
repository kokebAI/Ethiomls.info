import { NextRequest, NextResponse } from "next/server";
import { activateListing } from "@/src/services/listing-lifecycle.service";
import { getCurrentAdmin } from "@/lib/auth/admin";

export const runtime = "nodejs";

/**
 * POST /api/listings/[id]/activate
 * Moves listing → PropertyStatus.ACTIVE and enqueues Telegram broadcast.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "An active admin account is required to publish listings",
          statusCode: 403,
        },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json(
        { error: "ValidationError", message: "listing id required", statusCode: 400 },
        { status: 400 },
      );
    }

    const result = await activateListing(id.trim());
    return NextResponse.json(
      {
        ok: true,
        listingId: result.listingId,
        status: result.status,
        propertyStatus: "ACTIVE",
        broadcastJobId: result.broadcastJobId,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[POST /api/listings/[id]/activate]", error);
    const message =
      error instanceof Error ? error.message : "Failed to activate listing";
    const isAuditBlock =
      message.includes("audit") || message.includes("pending-review");
    return NextResponse.json(
      {
        error: isAuditBlock ? "AuditRequired" : "InternalServerError",
        message,
        statusCode: isAuditBlock ? 422 : 500,
      },
      { status: isAuditBlock ? 422 : 500 },
    );
  }
}
