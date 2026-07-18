import { NextRequest, NextResponse } from "next/server";
import { issueOtp, normalizeEthiopiaPhone } from "@/lib/auth/otp";
import { isLocale } from "@/lib/i18n/config";
import { smsNotificationEngine } from "@/src/services/sms.service";

export const runtime = "nodejs";

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
  const fullName =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { fullName?: unknown }).fullName ?? "").trim()
      : "";
  const localeRaw =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { locale?: unknown }).locale ?? "am")
      : "am";
  const locale = isLocale(localeRaw) ? localeRaw : "am";

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

  const { code, ttlSec } = await issueOtp({ phone, fullName, locale });
  const sms = await smsNotificationEngine.sendRaw({
    toE164: phone,
    locale,
    body: `EthioMLS code: ${code}. Valid ${Math.floor(ttlSec / 60)} min.`,
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
    /** Dev-only: OTP echoed when SMS_PROVIDER=mock so local testing works */
    debugCode: sms.provider === "mock" ? code : undefined,
  });
}
