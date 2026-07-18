import { NextRequest, NextResponse } from "next/server";
import { googleOAuthConfigured, googleRedirectUri } from "@/lib/auth/oauth";
import { newOAuthState } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";

const OAUTH_STATE_COOKIE = "ethiomls_oauth_state";

/**
 * Start Google OAuth for admin + client accounts.
 * Query: locale, mode=login|register, next=path, role=BUYER_RENTER (register only)
 */
export async function GET(request: NextRequest) {
  const localeRaw = request.nextUrl.searchParams.get("locale") ?? "en";
  const locale = isLocale(localeRaw) ? localeRaw : "en";
  const origin = request.nextUrl.origin;

  if (!googleOAuthConfigured()) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = "";
    url.searchParams.set(
      "error",
      "Gmail sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Vercel.",
    );
    return NextResponse.redirect(url);
  }

  const modeRaw = request.nextUrl.searchParams.get("mode") ?? "login";
  const mode = modeRaw === "register" ? "register" : "login";
  const nextRaw = request.nextUrl.searchParams.get("next") ?? "";
  const next = nextRaw.startsWith("/") ? nextRaw.slice(0, 200) : "";
  // New Google accounts are always clients; admin must already exist by email.
  const role = "BUYER_RENTER";

  const state = [
    newOAuthState(),
    locale,
    mode,
    role,
    encodeURIComponent(next),
  ].join(".");

  const redirectUri = googleRedirectUri(origin);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
