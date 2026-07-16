import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import {
  googleOAuthConfigured,
  googleRedirectUri,
  oauthPlaceholderPasswordHash,
} from "@/lib/auth/oauth";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/config";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const cookieState = request.cookies.get("ethiomls_oauth_state")?.value;
  const localePart = state.split(".")[1] ?? "en";
  const locale = isLocale(localePart) ? localePart : "en";

  const fail = (message: string) =>
    NextResponse.redirect(
      `${origin}/${locale}/login?error=${encodeURIComponent(message)}`,
    );

  if (!googleOAuthConfigured()) {
    return fail("Google OAuth is not configured");
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("Invalid OAuth state");
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
    name?: string;
  };

  if (!profile.email) return fail("Google account has no email");

  const email = profile.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
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

  const response = NextResponse.redirect(`${origin}/${locale}`);
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
  response.cookies.delete("ethiomls_oauth_state");
  return response;
}
