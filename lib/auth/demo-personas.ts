/**
 * Seeded EthioMLS demo personas. Phones stay in DB for uniqueness/SMS;
 * product surfaces should hide them and prefer email + Demo123! login.
 */

export const DEMO_LOGIN_PASSWORD = "Demo123!";

const DEMO_EMAILS = new Set(
  [
    "support@agtplc.com",
    "client@ethiomls.local",
    "broker@ethiomls.local",
    "owner@ethiomls.local",
    "developer@ethiomls.local",
    "assistant@ethiomls.local",
  ].map((e) => e.toLowerCase()),
);

/** Internal seed phones — never show in demo UI / role cards. */
export const DEMO_INTERNAL_PHONES = new Set([
  "+251911000001",
  "+251911000002",
  "+251911000003",
  "+251911000004",
  "+251911000005",
  "+251911000006",
]);

export function isDemoPersonaEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (DEMO_EMAILS.has(normalized)) return true;
  return normalized.endsWith("@ethiomls.local");
}

export function isDemoInternalPhone(
  phone: string | null | undefined,
): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  if (digits === "251911000001" || digits === "0911000001") return true;
  const e164 = phone.startsWith("+") ? phone : digits.startsWith("251") ? `+${digits}` : null;
  if (e164 && DEMO_INTERNAL_PHONES.has(e164)) return true;
  // Seed range +251911000001–006
  return /^25191100000[1-6]$/.test(digits) || /^091100000[1-6]$/.test(digits);
}

export function isDemoPersona(input: {
  email?: string | null;
  phone?: string | null;
}): boolean {
  return (
    isDemoPersonaEmail(input.email) || isDemoInternalPhone(input.phone)
  );
}

/** Display value when phone must be hidden for a demo persona. */
export function demoHiddenPhoneLabel(): string {
  return "—";
}
