import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import {
  issueOtp,
  normalizeEthiopiaPhone,
  type DeveloperBusinessSignup,
} from "@/lib/auth/otp";
import { isSignupRole } from "@/lib/auth/signup-roles";
import { isLocale } from "@/lib/i18n/config";
import { smsNotificationEngine } from "@/src/services/sms.service";

export const runtime = "nodejs";

function readBodyString(
  body: unknown,
  key: string,
): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  return String((body as Record<string, unknown>)[key] ?? "").trim();
}

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

  const phoneRaw = readBodyString(body, "phone");
  const fullName = readBodyString(body, "fullName");
  const localeRaw = readBodyString(body, "locale") || "am";
  const locale = isLocale(localeRaw) ? localeRaw : "am";
  const mode = readBodyString(body, "mode") || "login";
  const roleRaw =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { role?: unknown }).role
      : undefined;

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

  // Sign-in uses phone + password (/api/auth/login). OTP is only for
  // registration and new-device challenges issued by that login route.
  if (mode !== "register") {
    return NextResponse.json(
      {
        error: "PasswordRequired",
        message:
          "Sign in with your phone and password. SMS is only sent on new devices after password is verified.",
      },
      { status: 400 },
    );
  }

  let business: DeveloperBusinessSignup | undefined;

  if (mode === "register") {
    if (fullName.length < 2) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message: "Full name is required to register",
        },
        { status: 400 },
      );
    }
    if (!isSignupRole(roleRaw)) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message: "Choose one account role to continue registration",
        },
        { status: 400 },
      );
    }

    if (roleRaw === UserRole.CORPORATE_DEVELOPER) {
      const tradeName = readBodyString(body, "tradeName");
      const registrationNumber = readBodyString(body, "registrationNumber");
      const tin = readBodyString(body, "tin");
      const licenseNumber = readBodyString(body, "licenseNumber");
      if (tradeName.length < 2 || registrationNumber.length < 2) {
        return NextResponse.json(
          {
            error: "ValidationError",
            message:
              "Developer signup requires trade name and business registration number",
          },
          { status: 400 },
        );
      }
      business = {
        tradeName,
        registrationNumber,
        ...(tin.length >= 2 ? { tin } : {}),
        ...(licenseNumber.length >= 2 ? { licenseNumber } : {}),
      };
    }
  }

  const { code, ttlSec } = await issueOtp({
    phone,
    fullName: mode === "register" ? fullName : undefined,
    locale,
    role: mode === "register" && isSignupRole(roleRaw) ? roleRaw : undefined,
    business,
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
