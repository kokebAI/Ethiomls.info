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

function sessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    "ethiomls-dev-session-secret-change-me"
  );
}

function sign(payloadJson: string): string {
  return createHmac("sha256", sessionSecret())
    .update(payloadJson)
    .digest("base64url");
}

export function encodeSession(payload: Omit<SessionPayload, "exp">): string {
  const body: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
  const json = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${json}.${sign(json)}`;
}

export function decodeSession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [json, sig] = token.split(".");
  if (!json || !sig) return null;
  const expected = sign(json);
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
