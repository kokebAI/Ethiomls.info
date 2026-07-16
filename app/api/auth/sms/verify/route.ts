import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { verifyOtp, normalizeEthiopiaPhone } from "@/lib/auth/otp";
import { oauthPlaceholderPasswordHash } from "@/lib/auth/oauth";
import { setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

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
  const code =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { code?: unknown }).code ?? "").trim()
      : "";
  const mode =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { mode?: unknown }).mode ?? "login")
      : "login";

  const phone = normalizeEthiopiaPhone(phoneRaw);
  if (!phone || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "ValidationError", message: "Phone and 6-digit code required" },
      { status: 400 },
    );
  }

  const check = verifyOtp(phone, code);
  if (!check.ok) {
    return NextResponse.json(
      { error: "OtpInvalid", message: check.error },
      { status: 401 },
    );
  }

  let user = await prisma.user.findUnique({ where: { phone } });

  if (!user && mode === "login") {
    // Auto-register on first successful OTP (common SMS auth UX)
  }

  if (!user) {
    const fullName =
      check.record.fullName?.trim() ||
      `EthioMLS User ${phone.slice(-4)}`;
    const email = `sms.${phone.replace(/\D/g, "")}@users.ethiomls.local`;
    user = await prisma.user.create({
      data: {
        email,
        phone,
        fullName,
        passwordHash: oauthPlaceholderPasswordHash(phone),
        role: UserRole.BUYER_RENTER,
        localePrefs: check.record.locale
          ? [check.record.locale, "en"]
          : ["am", "en"],
      },
    });
  }

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
    },
  });
}
