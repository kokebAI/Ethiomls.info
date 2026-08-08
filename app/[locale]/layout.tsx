import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SiteMapBackdrop } from "@/components/SiteMapBackdrop";
import { DocumentLocale } from "@/components/DocumentLocale";
import { Header } from "@/components/Header";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { JsonLd } from "@/components/seo/JsonLd";
import { CurrencyPreferenceProvider } from "@/hooks/useCurrencyPreference";
import { TranslationProvider } from "@/hooks/useTranslation";
import { isLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { readDisplayCurrencyPreference } from "@/lib/currency/server";
import { buildRootLocaleMetadata } from "@/lib/seo/build-metadata";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** Allow `/en` (and other locales) even if a deploy skips static params. */
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);

  return buildRootLocaleMetadata(locale, {
    name: dictionary.brand.name,
    tagline: dictionary.brand.tagline,
  });
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;

  if (!isLocale(raw)) {
    notFound();
  }

  const locale = raw;
  const dictionary = getDictionary(locale);
  const usesEthiopic = locale === "am" || locale === "ti";
  const { currency, rateUsdEtb } = await readDisplayCurrencyPreference();

  return (
    <TranslationProvider locale={locale} dictionary={dictionary}>
      <CurrencyPreferenceProvider
        initialCurrency={currency}
        initialRateUsdEtb={rateUsdEtb}
      >
        <DocumentLocale />
        <JsonLd data={[organizationJsonLd(), websiteJsonLd(locale)]} />
        <div
          className={`relative isolate min-h-screen ${usesEthiopic ? "[font-family:var(--font-ethiopic),var(--font-sans),sans-serif]" : ""}`}
          lang={locale}
          data-locale={locale}
          data-currency={currency}
        >
          <SiteMapBackdrop />
          <Header />
          <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
            {children}
          </main>
        </div>
        <ServiceWorkerRegister />
      </CurrencyPreferenceProvider>
    </TranslationProvider>
  );
}
