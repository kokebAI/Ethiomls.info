"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useTranslation } from "@/hooks/useTranslation";

const NAV_ITEMS = [
  { href: "", key: "nav.home" },
  { href: "/listings", key: "nav.listings" },
  { href: "/projects", key: "nav.projects" },
  { href: "/developers", key: "nav.developers" },
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/profile", key: "nav.profile" },
] as const;

export function Header() {
  const { locale, t } = useTranslation();
  const base = `/${locale}`;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[4.5rem] w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href={base}
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
          {NAV_ITEMS.map((item) => (
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
          <Link
            href={`${base}/login`}
            className="hidden rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50 md:inline-flex"
          >
            {t("nav.signIn")}
          </Link>
          <Link
            href={`${base}/listings`}
            className="hidden rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-brand-700 md:inline-flex"
          >
            {t("header.browseListings")}
          </Link>
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
            {NAV_ITEMS.map((item) => (
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
              <Link
                href={`${base}/login`}
                className="flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink"
                onClick={() => setMobileOpen(false)}
              >
                {t("nav.signIn")}
              </Link>
            </li>
            <li className="pt-1">
              <Link
                href={`${base}/listings`}
                className="flex w-full items-center justify-center rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
                onClick={() => setMobileOpen(false)}
              >
                {t("header.browseListings")}
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
