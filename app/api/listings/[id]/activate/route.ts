import { NextRequest, NextResponse } from "next/server";
import { activateListing } from "@/src/services/listing-lifecycle.service";

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
    return NextResponse.json(
      {
        error: "InternalServerError",
        message:
          error instanceof Error ? error.message : "Failed to activate listing",
        statusCode: 500,
      },
      { status: 500 },
    );
  }
}
