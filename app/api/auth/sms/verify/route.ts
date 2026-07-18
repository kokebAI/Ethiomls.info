import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { verifyOtp, normalizeEthiopiaPhone } from "@/lib/auth/otp";
import {
  hashPassword,
  isPasswordStrong,
} from "@/lib/auth/password";
import { isSignupRole } from "@/lib/auth/signup-roles";
import { setSessionCookie } from "@/lib/auth/session";
import {
  clearPendingPasswordLogin,
  getPendingPasswordLogin,
  setTrustedDeviceCookie,
} from "@/lib/auth/trusted-device";
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

  const check = await verifyOtp(phone, code);
  if (!check.ok) {
    return NextResponse.json(
      { error: "OtpInvalid", message: check.error },
      { status: 401 },
    );
  }

  let user = await prisma.user.findUnique({ where: { phone } });

  // Password-login new-device challenge: password already verified; OTP finishes session.
  if (mode === "login") {
    if (!user) {
      return NextResponse.json(
        {
          error: "AccountNotFound",
          message:
            "No account for this number. Register with your local phone first.",
        },
        { status: 404 },
      );
    }
    const pendingUserId = await getPendingPasswordLogin();
    if (!pendingUserId || pendingUserId !== user.id) {
      return NextResponse.json(
        {
          error: "PasswordRequired",
          message:
            "Sign in with phone and password first. SMS codes alone cannot open a session.",
        },
        { status: 403 },
      );
    }
    await clearPendingPasswordLogin();
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
    });
    await setTrustedDeviceCookie(user.id);
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role as UserRole,
      },
    });
  }

  if (!user) {
    const role = check.record.role;
    if (!isSignupRole(role)) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message:
            "Choose one account role before verifying. Restart registration.",
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

    if (role === UserRole.CORPORATE_DEVELOPER && !check.record.business) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message:
            "Developer signup requires business registration. Restart registration and enter trade name and registration number.",
        },
        { status: 400 },
      );
    }

    const fullName =
      check.record.fullName?.trim() ||
      `EthioMLS User ${phone.slice(-4)}`;
    const passwordHash = await hashPassword(password);

    try {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            phone,
            fullName,
            passwordHash,
            role,
            localePrefs: check.record.locale
              ? [check.record.locale, "en"]
              : ["am", "en"],
          },
        });

        if (role === UserRole.CORPORATE_DEVELOPER && check.record.business) {
          const biz = check.record.business;
          await tx.developerProfile.create({
            data: {
              userId: created.id,
              tradeName: biz.tradeName,
              displayName: { en: biz.tradeName },
              registrationNumber: biz.registrationNumber,
              tin: biz.tin ?? null,
              licenseNumber: biz.licenseNumber ?? null,
            },
          });
        }

        return created;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return NextResponse.json(
          {
            error: "Conflict",
            message:
              "That business registration number is already registered. Sign in or use a different number.",
          },
          { status: 409 },
        );
      }
      throw err;
    }
  } else if (mode === "register") {
    // Existing account — allow setting password if they verified OTP with a new password.
    if (isPasswordStrong(password)) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      });
    }
  }

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
  });
  await setTrustedDeviceCookie(user.id);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role as UserRole,
    },
  });
}
