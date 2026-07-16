import { NextRequest, NextResponse } from "next/server";
import { notifyListingVerification } from "@/src/services/listing-lifecycle.service";

export const runtime = "nodejs";

/**
 * POST /api/listings/[id]/verification-notify
 * Body: { kind: "mesob" | "escrow" }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { kind?: string };
    const kind = body.kind === "escrow" ? "escrow" : "mesob";

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "ValidationError", message: "listing id required", statusCode: 400 },
        { status: 400 },
      );
    }

    const result = await notifyListingVerification(id.trim(), kind);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "SmsDispatchError",
          message: "error" in result ? result.error : "SMS failed",
          statusCode: 422,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, sms: result }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/listings/[id]/verification-notify]", error);
    return NextResponse.json(
      {
        error: "InternalServerError",
        message: "Failed to send verification SMS",
        statusCode: 500,
      },
      { status: 500 },
    );
  }
}
