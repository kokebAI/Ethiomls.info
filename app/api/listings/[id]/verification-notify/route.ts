import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import { notifyListingVerification } from "@/src/services/listing-lifecycle.service";

const bodySchema = z.object({
  kind: z.enum(["mesob", "escrow"]).default("mesob"),
});

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
    const staff = await getCurrentOpsStaff();
    if (!staff) {
      return NextResponse.json(
        { error: "Forbidden", message: "Staff access required", statusCode: 403 },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    let raw: unknown = {};
    try {
      raw = await request.json();
    } catch {
      raw = {};
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message: "kind must be mesob or escrow",
          statusCode: 400,
        },
        { status: 400 },
      );
    }
    const kind = parsed.data.kind;

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
