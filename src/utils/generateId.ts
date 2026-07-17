const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ID_LENGTH = 6;
const MAX_UNBIASED_BYTE = 252;

/**
 * Generates a cryptographically random six-character property ID.
 * The API still relies on the database primary-key constraint to reject the
 * extremely unlikely case where two clients generate the same ID.
 */
export function generatePropertyId(): string {
  const id: string[] = [];

  while (id.length < ID_LENGTH) {
    const bytes = new Uint8Array(ID_LENGTH - id.length);
    crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte >= MAX_UNBIASED_BYTE) continue;
      id.push(ALPHANUMERIC[byte % ALPHANUMERIC.length]);
    }
  }

  return id.join("");
}

export default generatePropertyId;
