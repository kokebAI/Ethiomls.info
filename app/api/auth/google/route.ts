import { NextRequest, NextResponse } from "next/server";
import { googleOAuthConfigured, googleRedirectUri } from "@/lib/auth/oauth";
import { newOAuthState } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!googleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "GoogleNotConfigured",
        message:
          "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (and optional GOOGLE_REDIRECT_URI) to enable Gmail sign-in.",
      },
      { status: 503 },
    );
  }

  const origin = request.nextUrl.origin;
  const locale = request.nextUrl.searchParams.get("locale") || "en";
  const state = `${newOAuthState()}.${locale}`;
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
  response.cookies.set("ethiomls_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
