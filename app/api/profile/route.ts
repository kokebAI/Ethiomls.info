import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z
    .union([z.string().trim().email().max(160), z.literal("")])
    .optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sign in required" },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      role: true,
      localePrefs: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "NotFound", message: "User not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: user });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sign in required" },
      { status: 401 },
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

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Provide a valid full name and/or email address",
      },
      { status: 400 },
    );
  }

  const email =
    parsed.data.email === undefined
      ? undefined
      : parsed.data.email === ""
        ? null
        : parsed.data.email.toLowerCase();

  if (email) {
    const taken = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id: session.userId },
      },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json(
        {
          error: "EmailTaken",
          message: "That email is already linked to another account",
        },
        { status: 409 },
      );
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: {
        ...(parsed.data.fullName ? { fullName: parsed.data.fullName } : {}),
        ...(email !== undefined ? { email } : {}),
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        role: true,
      },
    });

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("[PATCH /api/profile]", error);
    return NextResponse.json(
      { error: "InternalServerError", message: "Could not update profile" },
      { status: 500 },
    );
  }
}
