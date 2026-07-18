import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  isPasswordStrong,
  isPlaceholderPasswordHash,
  verifyPassword,
} from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * POST /api/auth/password/change
 * Authenticated password change for every role.
 * OAuth-only accounts (placeholder hash) may set a first password without current.
 */
export async function POST(request: NextRequest) {
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

  const currentPassword =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { currentPassword?: unknown }).currentPassword ?? "")
      : "";
  const newPassword =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { newPassword?: unknown }).newPassword ?? "")
      : "";

  if (!isPasswordStrong(newPassword)) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "New password must be at least 8 characters",
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "NotFound", message: "Account not found" },
      { status: 404 },
    );
  }

  const needsCurrent = !isPlaceholderPasswordHash(user.passwordHash);
  if (needsCurrent) {
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        {
          error: "InvalidCredentials",
          message: "Current password is incorrect",
        },
        { status: 401 },
      );
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return NextResponse.json({ ok: true });
}
