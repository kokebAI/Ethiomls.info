import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "ethiomls_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export type SessionPayload = {
  userId: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  exp: number;
};

const DEV_SESSION_SECRET = "ethiomls-dev-session-secret-change-me";

/**
 * Production must set AUTH_SESSION_SECRET on the Telecloud host.
 * The old fallbacks (a public string, or GEMINI_API_KEY) are not used:
 * a secret that ships in this public repo can forge session cookies.
 * When unset in production, reads fail closed (no session) and writes throw.
 */
function sessionSecret(): string | null {
  const configured = process.env.AUTH_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return DEV_SESSION_SECRET;
}

function sign(payloadJson: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadJson).digest("base64url");
}

export function encodeSession(payload: Omit<SessionPayload, "exp">): string {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error(
      "AUTH_SESSION_SECRET is required in production. Set a long random value on the Telecloud host before sign-in.",
    );
  }
  const body: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
  const json = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${json}.${sign(json, secret)}`;
}

export function decodeSession(token: string | undefined | null): SessionPayload | null {
  const secret = sessionSecret();
  if (!secret || !token) return null;
  const [json, sig] = token.split(".");
  if (!json || !sig) return null;
  const expected = sign(json, secret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(json, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload?.userId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: Omit<SessionPayload, "exp">) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

export function newOAuthState(): string {
  return randomBytes(16).toString("hex");
}
