"use client";

import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

const NAV_ITEMS = [
  { href: "", key: "nav.home" },
  { href: "/listings", key: "nav.listings" },
  { href: "/projects", key: "nav.projects" },
  { href: "/developers", key: "nav.developers" },
] as const;

export function Header() {
  const { locale, t } = useTranslation();
  const base = `/${locale}`;

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href={base} className="site-header__brand">
          <span className="site-header__mark" aria-hidden="true">
            እ
          </span>
          <span className="site-header__brand-text">
            <span className="site-header__name">{t("brand.name")}</span>
            <span className="site-header__tagline">{t("brand.tagline")}</span>
          </span>
        </Link>

        <nav className="site-header__nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={`${base}${item.href}`}
              className="site-header__link"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="site-header__actions">
          <LocaleSwitcher />
          <Link href={`${base}/listings`} className="site-header__cta">
            {t("header.browseListings")}
          </Link>
        </div>
      </div>
    </header>
  );
}
