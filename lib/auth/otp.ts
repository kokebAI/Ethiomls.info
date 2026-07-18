import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { isSignupRole, type SignupRole } from "@/lib/auth/signup-roles";

export type DeveloperBusinessSignup = {
  tradeName: string;
  registrationNumber: string;
  tin?: string;
  licenseNumber?: string;
};

type OtpRecord = {
  phone: string;
  fullName?: string;
  locale?: string;
  role?: SignupRole;
  business?: DeveloperBusinessSignup;
};

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Normalize Ethiopian mobile numbers only (Ethio telecom / Safaricom local).
 * Accepts 09…, 07…, 2519…, +2519… and returns E.164 (+251…).
 * International numbers are rejected — signup is local-phone only.
 */
export function normalizeEthiopiaPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "").trim();
  if (/^\+251[79]\d{8}$/.test(digits)) return digits;
  if (/^0[79]\d{8}$/.test(digits)) return `+251${digits.slice(1)}`;
  if (/^251[79]\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

/**
 * Issue (or replace) the OTP for a phone number.
 * DB-backed so verification works across serverless instances and restarts.
 */
export async function issueOtp(input: {
  phone: string;
  fullName?: string;
  locale?: string;
  role?: SignupRole;
  business?: DeveloperBusinessSignup;
}): Promise<{ code: string; ttlSec: number }> {
  const code = String(randomInt(100000, 999999));
  const ttlSec = 10 * 60;
  const expiresAt = new Date(Date.now() + ttlSec * 1000);

  await prisma.otpCode.upsert({
    where: { phone: input.phone },
    update: {
      codeHash: hashCode(code),
      fullName: input.fullName ?? null,
      locale: input.locale ?? null,
      role: input.role ?? null,
      tradeName: input.business?.tradeName ?? null,
      registrationNumber: input.business?.registrationNumber ?? null,
      tin: input.business?.tin ?? null,
      licenseNumber: input.business?.licenseNumber ?? null,
      expiresAt,
      attempts: 0,
    },
    create: {
      phone: input.phone,
      codeHash: hashCode(code),
      fullName: input.fullName ?? null,
      locale: input.locale ?? null,
      role: input.role ?? null,
      tradeName: input.business?.tradeName ?? null,
      registrationNumber: input.business?.registrationNumber ?? null,
      tin: input.business?.tin ?? null,
      licenseNumber: input.business?.licenseNumber ?? null,
      expiresAt,
    },
  });

  return { code, ttlSec };
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<{ ok: true; record: OtpRecord } | { ok: false; error: string }> {
  const record = await prisma.otpCode.findUnique({ where: { phone } });
  if (!record) return { ok: false, error: "OTP expired or not requested" };

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.delete({ where: { phone } }).catch(() => {});
    return { ok: false, error: "OTP expired" };
  }

  if (record.attempts >= 8) {
    await prisma.otpCode.delete({ where: { phone } }).catch(() => {});
    return { ok: false, error: "Too many attempts" };
  }

  if (hashCode(code.trim()) !== record.codeHash) {
    await prisma.otpCode.update({
      where: { phone },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "Invalid code" };
  }

  await prisma.otpCode.delete({ where: { phone } }).catch(() => {});

  const tradeName = record.tradeName?.trim();
  const registrationNumber = record.registrationNumber?.trim();
  const business =
    tradeName && registrationNumber
      ? {
          tradeName,
          registrationNumber,
          tin: record.tin?.trim() || undefined,
          licenseNumber: record.licenseNumber?.trim() || undefined,
        }
      : undefined;

  return {
    ok: true,
    record: {
      phone: record.phone,
      fullName: record.fullName ?? undefined,
      locale: record.locale ?? undefined,
      role: isSignupRole(record.role) ? record.role : undefined,
      business,
    },
  };
}
