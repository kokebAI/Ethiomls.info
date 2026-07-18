import { NextRequest, NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";

/** Google OAuth callback disabled — phone OTP is the only signup path. */
export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const localePart = state.split(".")[1] ?? "en";
  const locale = isLocale(localePart) ? localePart : "en";
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/login`;
  url.search = "";
  url.searchParams.set(
    "error",
    "Sign up with your Ethiopian mobile number. Email can be added later in your profile.",
  );
  return NextResponse.redirect(url);
}
