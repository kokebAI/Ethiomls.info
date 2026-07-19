import { normalizeEthiopiaPhone } from "@/lib/auth/otp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return null;
  return email;
}

export function looksLikeEmail(raw: string): boolean {
  return raw.trim().includes("@");
}

export type LoginIdentifier =
  | { kind: "phone"; phone: string }
  | { kind: "email"; email: string };

/** Resolve a login/register identifier as Ethiopian phone or email. */
export function resolveLoginIdentifier(raw: string): LoginIdentifier | null {
  const value = raw.trim();
  if (!value) return null;
  if (looksLikeEmail(value)) {
    const email = normalizeEmail(value);
    return email ? { kind: "email", email } : null;
  }
  const phone = normalizeEthiopiaPhone(value);
  return phone ? { kind: "phone", phone } : null;
}
