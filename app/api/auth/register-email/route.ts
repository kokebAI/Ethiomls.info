import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { normalizeEmail } from "@/lib/auth/identifier";
import { hashPassword, isPasswordStrong } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { setTrustedDeviceCookie } from "@/lib/auth/trusted-device";
import { isLocale } from "@/lib/i18n/config";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * POST /api/auth/register-email
 * Diaspora / international client signup with email + password (no Ethiopian phone).
 * Brokers, owners, and developers still use phone SMS registration.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "InvalidJson", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const email = normalizeEmail(String(record.email ?? ""));
  const fullName = String(record.fullName ?? "").trim();
  const password = String(record.password ?? "");
  const localeRaw = String(record.locale ?? "en");
  const locale = isLocale(localeRaw) ? localeRaw : "en";

  if (!email || fullName.length < 2 || !isPasswordStrong(password)) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message:
          "Enter your full name, a valid email, and a password (min 8 characters)",
      },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: "Conflict",
        message: "An account with that email already exists. Sign in instead.",
      },
      { status: 409 },
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        phone: null,
        fullName,
        passwordHash,
        role: UserRole.BUYER_RENTER,
        localePrefs: [locale, "en"],
      },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
      },
    });

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
    });
    await setTrustedDeviceCookie(user.id);

    return NextResponse.json({
      ok: true,
      needsOtp: false,
      user,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "Conflict",
          message: "An account with that email already exists. Sign in instead.",
        },
        { status: 409 },
      );
    }
    throw err;
  }
}
