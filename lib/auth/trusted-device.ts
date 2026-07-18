import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const TRUSTED_DEVICE_COOKIE = "ethiomls_device";
export const PENDING_LOGIN_COOKIE = "ethiomls_pwd_pending";

const TRUSTED_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
const PENDING_MAX_AGE_SEC = 10 * 60; // 10 minutes

function deviceSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    "ethiomls-dev-session-secret-change-me"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", deviceSecret()).update(payload).digest("base64url");
}

function pack(payload: object): string {
  const json = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${json}.${sign(json)}`;
}

function unpack<T extends { exp: number }>(token: string | undefined | null): T | null {
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
    ) as T;
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

type TrustedPayload = { userId: string; deviceId: string; exp: number };
type PendingPayload = { userId: string; exp: number };

export async function isTrustedDevice(userId: string): Promise<boolean> {
  const jar = await cookies();
  const payload = unpack<TrustedPayload>(jar.get(TRUSTED_DEVICE_COOKIE)?.value);
  return Boolean(payload && payload.userId === userId);
}

export async function setTrustedDeviceCookie(userId: string) {
  const jar = await cookies();
  const existing = unpack<TrustedPayload>(jar.get(TRUSTED_DEVICE_COOKIE)?.value);
  const deviceId =
    existing?.userId === userId ? existing.deviceId : randomBytes(16).toString("hex");
  jar.set(
    TRUSTED_DEVICE_COOKIE,
    pack({
      userId,
      deviceId,
      exp: Math.floor(Date.now() / 1000) + TRUSTED_MAX_AGE_SEC,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TRUSTED_MAX_AGE_SEC,
    },
  );
}

export async function setPendingPasswordLogin(userId: string) {
  const jar = await cookies();
  jar.set(
    PENDING_LOGIN_COOKIE,
    pack({
      userId,
      exp: Math.floor(Date.now() / 1000) + PENDING_MAX_AGE_SEC,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PENDING_MAX_AGE_SEC,
    },
  );
}

export async function getPendingPasswordLogin(): Promise<string | null> {
  const jar = await cookies();
  const payload = unpack<PendingPayload>(jar.get(PENDING_LOGIN_COOKIE)?.value);
  return payload?.userId ?? null;
}

export async function clearPendingPasswordLogin() {
  const jar = await cookies();
  jar.delete(PENDING_LOGIN_COOKIE);
}
