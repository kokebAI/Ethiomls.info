import { createHash } from "node:crypto";

/** Non-loginable stub for SMS / OAuth accounts until password is set. */
export function oauthPlaceholderPasswordHash(subject: string): string {
  return (
    "auth-oauth:" +
    createHash("sha256").update(`ethiomls:${subject}`).digest("hex")
  );
}

export function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export function googleRedirectUri(origin: string): string {
  return (
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${origin.replace(/\/$/, "")}/api/auth/google/callback`
  );
}
