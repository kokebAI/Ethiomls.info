/**
 * Cloudflare Turnstile verification for signup / reset OTP.
 * When TURNSTILE_SECRET_KEY is unset, checks are skipped (local/mock).
 */

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

export async function verifyTurnstileToken(input: {
  token: string | null | undefined;
  ip?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { ok: true };
  }

  const token = input.token?.trim();
  if (!token) {
    return {
      ok: false,
      message: "Complete the security check before requesting an SMS code.",
    };
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });
    if (input.ip && input.ip !== "unknown") {
      body.set("remoteip", input.ip);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    const payload = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (!payload.success) {
      return {
        ok: false,
        message: "Security check failed. Refresh and try again.",
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Security check unavailable. Try again in a moment.",
    };
  }
}
