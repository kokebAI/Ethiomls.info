import { NextRequest, NextResponse } from "next/server";
import { issueOtp, normalizeEthiopiaPhone } from "@/lib/auth/otp";
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
 * Phone + password. Trusted devices skip OTP; new devices get an SMS code.
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

  const phoneRaw =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { phone?: unknown }).phone ?? "")
      : "";
  const password =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { password?: unknown }).password ?? "")
      : "";
  const localeRaw =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { locale?: unknown }).locale ?? "en")
      : "en";
  const locale = isLocale(localeRaw) ? localeRaw : "en";

  const phone = normalizeEthiopiaPhone(phoneRaw);
  if (!phone || !isPasswordStrong(password)) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Enter a valid Ethiopian mobile number and password (min 8 characters)",
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { phone, isActive: true },
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
        message: "Wrong phone number or password",
      },
      { status: 401 },
    );
  }

  if (isPlaceholderPasswordHash(user.passwordHash)) {
    return NextResponse.json(
      {
        error: "PasswordRequired",
        message:
          "This account needs a password. Register again or reset via SMS verification.",
      },
      { status: 403 },
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      {
        error: "InvalidCredentials",
        message: "Wrong phone number or password",
      },
      { status: 401 },
    );
  }

  if (await isTrustedDevice(user.id)) {
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
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    });
  }

  // New / unrecognized device — require SMS OTP before session.
  await setPendingPasswordLogin(user.id);
  const { code, ttlSec } = await issueOtp({
    phone,
    locale,
  });
  const sms = await smsNotificationEngine.sendRaw({
    toE164: phone,
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
    phone,
    provider: sms.provider,
    expiresInSec: ttlSec,
    debugCode: sms.provider === "mock" ? code : undefined,
    message: "New device — enter the SMS code to finish signing in",
  });
}
