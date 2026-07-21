import { prisma } from "@/lib/db/prisma";

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

/**
 * Sliding fixed-window counter stored in Postgres so it works across
 * serverless instances (unlike in-memory Maps).
 */
export async function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const now = Date.now();
  const key = input.key.slice(0, 190);

  const existing = await prisma.rateLimitBucket.findUnique({
    where: { key },
  });

  if (
    !existing ||
    now - existing.windowStart.getTime() >= input.windowMs
  ) {
    await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, windowStart: new Date(now) },
      update: { count: 1, windowStart: new Date(now) },
    });
    return { ok: true, remaining: Math.max(0, input.limit - 1) };
  }

  if (existing.count >= input.limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil(
        (existing.windowStart.getTime() + input.windowMs - now) / 1000,
      ),
    );
    return { ok: false, retryAfterSec };
  }

  await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return {
    ok: true,
    remaining: Math.max(0, input.limit - existing.count - 1),
  };
}

export function clientIpFromRequest(request: {
  headers: { get(name: string): string | null };
}): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  return "unknown";
}

/**
 * Shared guards for any endpoint that issues an auth OTP SMS.
 */
export async function assertOtpSmsAllowed(input: {
  phone: string;
  ip: string;
  /** Registration display name — used to stop same-name phone spray. */
  fullName?: string | null;
  purpose: "register" | "login" | "reset";
}): Promise<RateLimitResult & { message?: string }> {
  const phoneKey = `otp:phone:${input.phone}`;
  const ipKey = `otp:ip:${input.purpose}:${input.ip}`;

  // Per-phone: at most 1 SMS / 60s (resend cooldown).
  const phoneBurst = await consumeRateLimit({
    key: `${phoneKey}:1m`,
    limit: 1,
    windowMs: 60_000,
  });
  if (!phoneBurst.ok) {
    return {
      ...phoneBurst,
      message: `Wait ${phoneBurst.retryAfterSec}s before requesting another code for this number.`,
    };
  }

  // Per-phone: at most 5 SMS / hour.
  const phoneHour = await consumeRateLimit({
    key: `${phoneKey}:1h`,
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!phoneHour.ok) {
    return {
      ...phoneHour,
      message:
        "Too many codes sent to this number. Try again in about an hour.",
    };
  }

  // Per-IP: register is strictest (stops phone spray bots).
  const ipLimit =
    input.purpose === "register" ? 8 : input.purpose === "reset" ? 10 : 15;
  const ipWindowMs =
    input.purpose === "register" ? 15 * 60_000 : 15 * 60_000;
  const ipBurst = await consumeRateLimit({
    key: `${ipKey}:15m`,
    limit: ipLimit,
    windowMs: ipWindowMs,
  });
  if (!ipBurst.ok) {
    return {
      ...ipBurst,
      message: `Too many SMS requests from this network. Try again in ${ipBurst.retryAfterSec}s.`,
    };
  }

  if (input.purpose === "register") {
    const ipHour = await consumeRateLimit({
      key: `${ipKey}:1h`,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (!ipHour.ok) {
      return {
        ...ipHour,
        message:
          "Too many signup codes from this network. Try again in about an hour.",
      };
    }

    const name = input.fullName?.trim().toLowerCase().replace(/\s+/g, " ");
    if (name && name.length >= 2) {
      const nameHour = await consumeRateLimit({
        key: `otp:name:${name.slice(0, 80)}:1h`,
        limit: 3,
        windowMs: 60 * 60_000,
      });
      if (!nameHour.ok) {
        return {
          ...nameHour,
          message:
            "Too many signup attempts under this name. Try again later or use an existing account.",
        };
      }
    }
  }

  return { ok: true, remaining: phoneHour.remaining };
}
