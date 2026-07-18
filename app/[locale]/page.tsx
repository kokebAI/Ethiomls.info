import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeClient } from "./home-client";
import { fetchHomeStats } from "@/lib/catalog/home-stats";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { nonClientCatalogRedirect } from "@/lib/roles/catalog-access";
import { buildPageMetadata } from "@/lib/seo/build-metadata";

/** Live market counters — render at request time. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);

  const title =
    locale === "en"
      ? "Buy & Rent Homes in Addis Ababa | EthioMLS for Diaspora Investors"
      : dictionary.brand.name;
  const description =
    locale === "en"
      ? "Search verified apartments, houses, and off-plan projects across Addis Ababa. EthioMLS helps Ethiopian diaspora and global investors buy or rent with escrow-backed confidence."
      : dictionary.brand.tagline;

  return buildPageMetadata({
    locale,
    path: "/",
    title,
    description,
    keywords: [
      "buy house Addis Ababa",
      "rent apartment Addis Ababa",
      "Ethiopian diaspora property",
      "invest in Ethiopia real estate",
    ],
  });
}

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "en";
  const toHub = await nonClientCatalogRedirect(locale);
  if (toHub) redirect(toHub);

  const stats = await fetchHomeStats();

  return <HomeClient stats={stats} />;
}
