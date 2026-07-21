import { NextRequest, NextResponse } from "next/server";
import { issueOtp, normalizeEthiopiaPhone } from "@/lib/auth/otp";
import {
  assertOtpSmsAllowed,
  clientIpFromRequest,
} from "@/lib/auth/otp-rate-limit";
import { isLocale } from "@/lib/i18n/config";
import { prisma } from "@/lib/db/prisma";
import { smsNotificationEngine } from "@/src/services/sms.service";

export const runtime = "nodejs";

/**
 * POST /api/auth/password/reset/request
 * Send SMS OTP so an existing account can set a new password.
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
  const localeRaw =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { locale?: unknown }).locale ?? "en")
      : "en";
  const locale = isLocale(localeRaw) ? localeRaw : "en";

  const phone = normalizeEthiopiaPhone(phoneRaw);
  if (!phone) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Enter a valid Ethiopia mobile number (+2519… / 09…)",
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { phone, isActive: true },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      {
        error: "AccountNotFound",
        message: "No active account for this number. Register first.",
      },
      { status: 404 },
    );
  }

  const rate = await assertOtpSmsAllowed({
    phone,
    ip: clientIpFromRequest(request),
    purpose: "reset",
  });
  if (!rate.ok) {
    return NextResponse.json(
      {
        error: "RateLimited",
        message: rate.message ?? "Too many SMS requests. Try again later.",
        retryAfterSec: rate.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  const { code, ttlSec } = await issueOtp({ phone, locale });
  const sms = await smsNotificationEngine.sendRaw({
    toE164: phone,
    locale,
    body: `EthioMLS reset code: ${code}. Valid ${Math.floor(ttlSec / 60)} min.`,
  });

  if (!sms.ok) {
    return NextResponse.json(
      {
        error: "SmsFailed",
        message: sms.error ?? "Could not send SMS",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    phone,
    provider: sms.provider,
    expiresInSec: ttlSec,
    debugCode: sms.provider === "mock" ? code : undefined,
  });
}
