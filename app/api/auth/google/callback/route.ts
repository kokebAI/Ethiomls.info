import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import {
  googleOAuthConfigured,
  googleRedirectUri,
  oauthPlaceholderPasswordHash,
} from "@/lib/auth/oauth";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/config";
import { hubPathForRole } from "@/lib/roles/hubs";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const OAUTH_STATE_COOKIE = "ethiomls_oauth_state";

/** Roles allowed to sign in with Gmail. */
const GOOGLE_ALLOWED_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.BUYER_RENTER,
];

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  const parts = state.split(".");
  const localePart = parts[1] ?? "en";
  const modePart = parts[2] ?? "login";
  const nextPart = parts[4] ? decodeURIComponent(parts[4]) : "";
  const locale = isLocale(localePart) ? localePart : "en";
  const mode = modePart === "register" ? "register" : "login";
  const next = nextPart.startsWith("/") ? nextPart : "";

  const fail = (message: string) => {
    const response = NextResponse.redirect(
      `${origin}/${locale}/login?error=${encodeURIComponent(message)}&mode=${mode}`,
    );
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  };

  if (!googleOAuthConfigured()) {
    return fail("Gmail sign-in is not configured");
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("Invalid Google sign-in state. Try again.");
  }

  const redirectUri = googleRedirectUri(origin);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return fail("Google token exchange failed");
  }

  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return fail("Missing Google access token");

  const profileRes = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    },
  );
  if (!profileRes.ok) return fail("Could not load Google profile");

  const profile = (await profileRes.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  };

  if (!profile.email) return fail("Google account has no email");
  if (profile.email_verified === false) {
    return fail("Verify your Gmail address with Google, then try again.");
  }

  const email = profile.email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    if (!user.isActive) {
      return fail("This account is deactivated.");
    }
    if (!GOOGLE_ALLOWED_ROLES.includes(user.role)) {
      return fail(
        "This account uses phone SMS login (broker, owner, or developer). Use your Ethiopian mobile number instead.",
      );
    }
  } else if (mode === "login") {
    return fail(
      "No account for this Gmail. Register as a client, or use SMS if you are an admin with a phone login.",
    );
  } else {
    // Register — Gmail signup is client-only (admin is never self-created).
    user = await prisma.user.create({
      data: {
        email,
        fullName: profile.name?.trim() || email.split("@")[0] || "Google user",
        passwordHash: oauthPlaceholderPasswordHash(email),
        role: UserRole.BUYER_RENTER,
        localePrefs: [locale, "en"],
      },
    });
  }

  if (!user) {
    return fail("Could not create session");
  }

  const destination = next || `/${locale}${hubPathForRole(user.role)}`;
  const response = NextResponse.redirect(
    destination.startsWith("http")
      ? `${origin}/${locale}${hubPathForRole(user.role)}`
      : destination.startsWith("/")
        ? `${origin}${destination}`
        : `${origin}/${locale}${hubPathForRole(user.role)}`,
  );

  response.cookies.set(
    SESSION_COOKIE,
    encodeSession({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    },
  );
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
