import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale, locales, type Locale } from "@/lib/i18n/config";

const PUBLIC_FILE = /\.[^/]+$/;
const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Amharic-first: every visitor lands on the default locale (am) unless they
 * explicitly chose a language before (persisted in the NEXT_LOCALE cookie).
 * Accept-Language is intentionally ignored so English-configured browsers
 * still get Amharic on first visit.
 */
function negotiateLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale;
  }
  return defaultLocale;
}

function getPathLocale(pathname: string): Locale | null {
  const segment = pathname.split("/")[1];
  return segment && isLocale(segment) ? segment : null;
}

/**
 * Next.js 16 network proxy (replaces deprecated middleware.ts).
 * Handles locale negotiation and canonical locale redirects.
 *
 * Matcher must include `/` and `/{locale}` — do not exclude home routes.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const pathLocale = getPathLocale(pathname);

  // Locale already in the path — continue and expose it to the app.
  if (pathLocale) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-ethiomls-locale", pathLocale);
    requestHeaders.set("x-pathname", pathname);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.cookies.set(LOCALE_COOKIE, pathLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  // No locale prefix — redirect to the canonical localized URL.
  const locale = negotiateLocale(request);
  const url = request.nextUrl.clone();
  url.pathname =
    pathname === "/"
      ? `/${locale}`
      : `/${locale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;

  const response = NextResponse.redirect(url);
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: [
    // Always run on `/` (some path-to-regexp builds skip bare `/` in the catch-all).
    "/",
    /*
     * Match all pathnames except:
     * - api routes
     * - _next internals
     * - static files (containing a dot)
     */
    "/((?!api|_next/static|_next/image|_next/data|favicon.ico|.*\\..*).*)",
  ],
};

export const supportedLocales = locales;
