import { NextRequest, NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";

/** Google signup is disabled — EthioMLS accounts use local phone OTP only. */
export async function GET(request: NextRequest) {
  const localeRaw = request.nextUrl.searchParams.get("locale") ?? "en";
  const locale = isLocale(localeRaw) ? localeRaw : "en";
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/login`;
  url.search = "";
  url.searchParams.set(
    "error",
    "Sign up with your Ethiopian mobile number. Email can be added later in your profile.",
  );
  return NextResponse.redirect(url);
}
