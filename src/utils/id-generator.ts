import { randomInt } from "node:crypto";

/** Uppercase alphanumeric alphabet for EthioMLS property tracking IDs. */
export const PROPERTY_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const PROPERTY_ID_LENGTH = 6;

/**
 * Cryptographically random uppercase alphanumeric string.
 * Default length 6 → e.g. `ADD48X`.
 */
export function generateId(length: number = PROPERTY_ID_LENGTH): string {
  if (length < 1) {
    throw new Error("generateId length must be >= 1");
  }

  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += PROPERTY_ID_ALPHABET[randomInt(PROPERTY_ID_ALPHABET.length)]!;
  }
  return out;
}

/**
 * Property / listing primary tracking ID — 6-character A–Z0–9.
 * Example: `ADD48X`
 */
export function generatePropertyId(): string {
  return generateId(PROPERTY_ID_LENGTH);
}

export function isPropertyId(value: string): boolean {
  return new RegExp(
    `^[${PROPERTY_ID_ALPHABET}]{${PROPERTY_ID_LENGTH}}$`,
  ).test(value);
}
