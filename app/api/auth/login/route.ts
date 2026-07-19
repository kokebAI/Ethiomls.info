import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { resolveLoginIdentifier } from "@/lib/auth/identifier";
import { issueOtp } from "@/lib/auth/otp";
import {
  isPasswordStrong,
  isPlaceholderPasswordHash,
  verifyPassword,
} from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import {
  isTrustedDevice,
  setPendingPasswordLogin,
  setTrustedDeviceCookie,
} from "@/lib/auth/trusted-device";
import { isLocale } from "@/lib/i18n/config";
import { prisma } from "@/lib/db/prisma";
import { smsNotificationEngine } from "@/src/services/sms.service";

export const runtime = "nodejs";

/**
 * POST /api/auth/login
 * Phone or email + password.
 * - Trusted devices skip OTP.
 * - Phone accounts on a new device get SMS OTP.
 * - Email-only (diaspora) clients skip SMS and sign in after password.
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
  const identifierRaw = String(
    record.identifier ?? record.email ?? record.phone ?? "",
  );
  const password = String(record.password ?? "");
  const localeRaw = String(record.locale ?? "en");
  const locale = isLocale(localeRaw) ? localeRaw : "en";

  const identifier = resolveLoginIdentifier(identifierRaw);
  if (!identifier || !isPasswordStrong(password)) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message:
          "Enter a valid email or Ethiopian mobile number and password (min 8 characters)",
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where:
      identifier.kind === "email"
        ? { email: identifier.email, isActive: true }
        : { phone: identifier.phone, isActive: true },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      role: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      {
        error: "InvalidCredentials",
        message: "Wrong email/phone or password",
      },
      { status: 401 },
    );
  }

  if (isPlaceholderPasswordHash(user.passwordHash)) {
    return NextResponse.json(
      {
        error: "PasswordRequired",
        message:
          user.email && !user.phone
            ? "This Google account needs a password set in your profile, or continue with Google."
            : "This account needs a password. Register again or reset via SMS verification.",
      },
      { status: 403 },
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      {
        error: "InvalidCredentials",
        message: "Wrong email/phone or password",
      },
      { status: 401 },
    );
  }

  async function completeSession() {
    await setSessionCookie({
      userId: user!.id,
      email: user!.email,
      phone: user!.phone,
      fullName: user!.fullName,
    });
    await setTrustedDeviceCookie(user!.id);
    return NextResponse.json({
      ok: true,
      needsOtp: false,
      user: {
        id: user!.id,
        fullName: user!.fullName,
        phone: user!.phone,
        email: user!.email,
        role: user!.role,
      },
    });
  }

  if (await isTrustedDevice(user.id)) {
    return completeSession();
  }

  // Email-only diaspora clients (and Google users who set a password) — no SMS path.
  if (!user.phone) {
    if (user.role !== UserRole.BUYER_RENTER && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        {
          error: "PhoneRequired",
          message:
            "This role must sign in with an Ethiopian mobile number.",
        },
        { status: 403 },
      );
    }
    return completeSession();
  }

  // New device + phone on file — SMS OTP challenge.
  await setPendingPasswordLogin(user.id);
  const { code, ttlSec } = await issueOtp({
    phone: user.phone,
    locale,
  });
  const sms = await smsNotificationEngine.sendRaw({
    toE164: user.phone,
    locale,
    body: `EthioMLS code: ${code}. Valid ${Math.floor(ttlSec / 60)} min.`,
  });

  if (!sms.ok) {
    return NextResponse.json(
      {
        error: "SmsFailed",
        message: sms.error ?? "Could not send SMS verification for this device",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    needsOtp: true,
    phone: user.phone,
    provider: sms.provider,
    expiresInSec: ttlSec,
    debugCode: sms.provider === "mock" ? code : undefined,
    message: "New device — enter the SMS code to finish signing in",
  });
}
