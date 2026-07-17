import { createHash } from "node:crypto";

/**
 * Pull Ethiopian mobile numbers from free text and normalize to E.164.
 */
export function extractEthiopiaPhones(text: string): string[] {
  const matches = text.matchAll(
    /(?:\+?251|0)?\s*[79]\s*(?:\d[\s-]*){8}/g,
  );
  const phones = new Set<string>();

  for (const match of matches) {
    const digits = match[0].replace(/\D/g, "");
    let e164: string | null = null;
    if (/^251[79]\d{8}$/.test(digits)) e164 = `+${digits}`;
    else if (/^0[79]\d{8}$/.test(digits)) e164 = `+251${digits.slice(1)}`;
    else if (/^[79]\d{8}$/.test(digits)) e164 = `+251${digits}`;
    if (e164) phones.add(e164);
  }

  return [...phones];
}

export function contentFingerprint(text: string): string {
  return createHash("sha256")
    .update(text.replace(/\s+/g, " ").trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
}
