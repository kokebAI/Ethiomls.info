import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale, locales, type Locale } from "@/lib/i18n/config";

const PUBLIC_FILE = /\.[^/]+$/;
const LOCALE_COOKIE = "NEXT_LOCALE";

function negotiateLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const header = request.headers.get("accept-language");
  if (!header) return defaultLocale;

  const preferred = header
    .split(",")
    .map((part) => {
      const [tag, qValue] = part.trim().split(";q=");
      const lang = tag?.split("-")[0]?.toLowerCase() ?? "";
      const q = qValue ? Number(qValue) : 1;
      return { lang, q: Number.isFinite(q) ? q : 1 };
    })
    .filter((entry) => entry.lang)
    .sort((a, b) => b.q - a.q);

  for (const entry of preferred) {
    if (isLocale(entry.lang)) return entry.lang;
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
