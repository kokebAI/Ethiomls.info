import { NextRequest, NextResponse } from "next/server";
import { verifyOtp, normalizeEthiopiaPhone } from "@/lib/auth/otp";
import {
  hashPassword,
  isPasswordStrong,
} from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { setTrustedDeviceCookie } from "@/lib/auth/trusted-device";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * POST /api/auth/password/reset/confirm
 * Verify SMS OTP and set a new password, then sign the user in.
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
  const code =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { code?: unknown }).code ?? "").trim()
      : "";
  const password =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as { password?: unknown }).password ?? "")
      : "";

  const phone = normalizeEthiopiaPhone(phoneRaw);
  if (!phone || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Ethiopian mobile number and 6-digit code required",
      },
      { status: 400 },
    );
  }

  if (!isPasswordStrong(password)) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Password must be at least 8 characters",
      },
      { status: 400 },
    );
  }

  const check = await verifyOtp(phone, code);
  if (!check.ok) {
    return NextResponse.json(
      { error: "OtpInvalid", message: check.error },
      { status: 401 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { phone, isActive: true },
  });

  if (!user) {
    return NextResponse.json(
      {
        error: "AccountNotFound",
        message: "No active account for this number",
      },
      { status: 404 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  await setSessionCookie({
    userId: updated.id,
    email: updated.email,
    phone: updated.phone,
    fullName: updated.fullName,
  });
  await setTrustedDeviceCookie(updated.id);

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      fullName: updated.fullName,
      phone: updated.phone,
      email: updated.email,
      role: updated.role,
    },
  });
}
