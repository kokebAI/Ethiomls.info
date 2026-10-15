import { isLocale } from "@/lib/i18n/config";

/**
 * Same-site path for post-login redirects.
 * Rejects protocol-relative URLs (`//evil.example`) and off-locale paths.
 */
export function safeInternalPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const path = value.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.includes("://") ||
    path.length > 300
  ) {
    return null;
  }
  const segment = path.split("/")[1] ?? "";
  if (segment && !isLocale(segment)) return null;
  return path;
}
