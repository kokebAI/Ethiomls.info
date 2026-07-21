import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import {
  listOfficeAssistants,
  resolveOrCreateOfficeAssistant,
  setOfficeAssistantActive,
} from "@/lib/auth/office-assistants";

export const runtime = "nodejs";

const createSchema = z.object({
  phone: z.string().trim().min(9).max(20),
  fullName: z.string().trim().min(2).max(120).optional(),
});

const patchSchema = z.object({
  userId: z.string().trim().min(1),
  isActive: z.boolean(),
});

/** List office assistant accounts (full admin only). */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
      { status: 403 },
    );
  }

  const data = await listOfficeAssistants();
  return NextResponse.json({ data });
}

/** Create or promote an office assistant by phone (full admin only). */
export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
      { status: 403 },
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Phone is required (optional full name)",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const result = await resolveOrCreateOfficeAssistant(parsed.data);
    return NextResponse.json(
      {
        data: result.assistant,
        created: result.created,
        promoted: result.promoted,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "CreateFailed",
        message:
          error instanceof Error
            ? error.message
            : "Could not create office assistant",
      },
      { status: 400 },
    );
  }
}

/** Activate / deactivate an office assistant (full admin only). */
export async function PATCH(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
      { status: 403 },
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "userId and isActive are required",
      },
      { status: 400 },
    );
  }

  try {
    const data = await setOfficeAssistantActive(parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: "UpdateFailed",
        message:
          error instanceof Error
            ? error.message
            : "Could not update office assistant",
      },
      { status: 400 },
    );
  }
}
