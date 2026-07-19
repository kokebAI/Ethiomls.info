"use client";

import Link from "next/link";
import { LogOut, Menu, UserRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { AdminAlertsBell } from "@/components/admin/AdminAlertsBell";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useTranslation } from "@/hooks/useTranslation";
import { hubPathForRole } from "@/lib/roles/hubs";

/** Public catalog tabs — only for guests and client (BUYER_RENTER) accounts. */
const CLIENT_CATALOG_NAV = [
  { href: "", key: "nav.home" },
  { href: "/listings", key: "nav.listings" },
  { href: "/projects", key: "nav.projects" },
  { href: "/developers", key: "nav.developers" },
] as const;

type SessionUser = {
  id: string;
  fullName: string;
  phone: string | null;
  role: string;
};

function isClientRole(role: string | null | undefined): boolean {
  return role === "BUYER_RENTER";
}

export function Header() {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const base = `/${locale}`;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Refetch on navigation so the header flips immediately after login/logout.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((payload: { user?: SessionUser | null }) => {
        if (!cancelled) {
          setUser(payload.user ?? null);
          setAuthReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function signOut() {
    setMobileOpen(false);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    router.push(`${base}/login`);
    router.refresh();
  }

  const showCatalog = !user || isClientRole(user.role);
  const homeHref =
    user && !isClientRole(user.role)
      ? `${base}${hubPathForRole(user.role)}`
      : base;

  const navItems: { href: string; key: string }[] = [];
  if (showCatalog) {
    for (const item of CLIENT_CATALOG_NAV) {
      navItems.push({ href: item.href, key: item.key });
    }
  }
  if (user) {
    navItems.push({
      href: hubPathForRole(user.role),
      key: isClientRole(user.role) ? "nav.forYou" : "nav.home",
    });
    navItems.push({ href: "/profile", key: "nav.profile" });
  }
  if (user?.role === "ADMIN") {
    navItems.push({ href: "/admin/imports", key: "nav.imports" });
    navItems.push({ href: "/admin/scrape-review", key: "nav.scrapeReview" });
  }
  if (user?.role === "ADMIN" || user?.role === "INDEPENDENT_DELALA") {
    navItems.push({ href: "/dashboard", key: "nav.dashboard" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[4.5rem] w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href={homeHref}
          className="flex min-w-0 shrink items-center gap-3"
          onClick={() => setMobileOpen(false)}
        >
          <BrandMark className="h-10 w-10 shrink-0" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-base font-bold tracking-tight text-slate-deep sm:text-[1.05rem]">
              {t("brand.name")}
            </span>
            <span className="hidden truncate text-xs leading-snug text-ink-muted sm:block lg:max-w-[18rem] xl:max-w-[22rem]">
              {t("brand.tagline")}
            </span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Primary"
        >
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={`${base}${item.href}`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-slate-100 hover:text-slate-deep"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LocaleSwitcher />
          {authReady && user?.role === "ADMIN" ? <AdminAlertsBell /> : null}
          {authReady && user ? (
            <>
              <Link
                href={`${base}/profile`}
                className="hidden max-w-[11rem] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50 md:inline-flex"
              >
                <UserRound className="h-4 w-4 shrink-0 text-brand-600" />
                <span className="truncate">{user.fullName}</span>
              </Link>
              <button
                type="button"
                className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50 md:inline-flex"
                onClick={() => void signOut()}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {t("auth.logout")}
              </button>
            </>
          ) : (
            <Link
              href={`${base}/login`}
              className="hidden rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50 md:inline-flex"
            >
              {t("nav.signIn")}
            </Link>
          )}
          {showCatalog ? (
            <Link
              href={`${base}/listings`}
              className="hidden rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-brand-700 md:inline-flex"
            >
              {t("header.browseListings")}
            </Link>
          ) : user ? (
            <Link
              href={`${base}${hubPathForRole(user.role)}`}
              className="hidden rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-brand-700 md:inline-flex"
            >
              {t("nav.home")}
            </Link>
          ) : null}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? t("header.menuClose") : t("header.menuOpen")}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav
          className="border-t border-slate-200/80 bg-white/95 px-4 py-3 lg:hidden"
          aria-label="Mobile"
        >
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={`${base}${item.href}`}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-brand-50 hover:text-brand-800"
                  onClick={() => setMobileOpen(false)}
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              {authReady && user ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink"
                  onClick={() => void signOut()}
                >
                  <LogOut className="h-4 w-4" />
                  {t("auth.logout")}
                </button>
              ) : (
                <Link
                  href={`${base}/login`}
                  className="flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink"
                  onClick={() => setMobileOpen(false)}
                >
                  {t("nav.signIn")}
                </Link>
              )}
            </li>
            {showCatalog ? (
              <li className="pt-1">
                <Link
                  href={`${base}/listings`}
                  className="flex w-full items-center justify-center rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  {t("header.browseListings")}
                </Link>
              </li>
            ) : user ? (
              <li className="pt-1">
                <Link
                  href={`${base}${hubPathForRole(user.role)}`}
                  className="flex w-full items-center justify-center rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  {t("nav.home")}
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
