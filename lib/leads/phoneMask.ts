/**
 * Mask E.164 broker telephone indices for public listing UIs.
 * Example: +251911234567 → +2519****4567
 */
export function maskE164Phone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length < 8) return "****";
  const visibleTail = trimmed.slice(-4);
  const visibleHead = trimmed.slice(0, Math.min(5, trimmed.length - 4));
  return `${visibleHead}****${visibleTail}`;
}

export function isConsentAccepted(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}
