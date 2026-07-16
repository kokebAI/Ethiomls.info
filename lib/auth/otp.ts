import { createHash, randomInt } from "node:crypto";

type OtpRecord = {
  codeHash: string;
  phone: string;
  fullName?: string;
  locale?: string;
  expiresAt: number;
  attempts: number;
};

const globalStore = globalThis as unknown as {
  __ethiomlsOtp?: Map<string, OtpRecord>;
};

function store(): Map<string, OtpRecord> {
  if (!globalStore.__ethiomlsOtp) {
    globalStore.__ethiomlsOtp = new Map();
  }
  return globalStore.__ethiomlsOtp;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function normalizeEthiopiaPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "").trim();
  if (/^\+251[79]\d{8}$/.test(digits)) return digits;
  if (/^0[79]\d{8}$/.test(digits)) return `+251${digits.slice(1)}`;
  if (/^251[79]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
}

export function issueOtp(input: {
  phone: string;
  fullName?: string;
  locale?: string;
}): { code: string; ttlSec: number } {
  const code = String(randomInt(100000, 999999));
  const ttlSec = 10 * 60;
  store().set(input.phone, {
    codeHash: hashCode(code),
    phone: input.phone,
    fullName: input.fullName,
    locale: input.locale,
    expiresAt: Date.now() + ttlSec * 1000,
    attempts: 0,
  });
  return { code, ttlSec };
}

export function verifyOtp(
  phone: string,
  code: string,
): { ok: true; record: OtpRecord } | { ok: false; error: string } {
  const record = store().get(phone);
  if (!record) return { ok: false, error: "OTP expired or not requested" };
  if (record.expiresAt < Date.now()) {
    store().delete(phone);
    return { ok: false, error: "OTP expired" };
  }
  record.attempts += 1;
  if (record.attempts > 8) {
    store().delete(phone);
    return { ok: false, error: "Too many attempts" };
  }
  if (hashCode(code.trim()) !== record.codeHash) {
    return { ok: false, error: "Invalid code" };
  }
  store().delete(phone);
  return { ok: true, record };
}
