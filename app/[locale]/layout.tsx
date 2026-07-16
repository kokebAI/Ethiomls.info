import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AddisSkylineBackdrop } from "@/components/AddisSkylineBackdrop";
import { DocumentLocale } from "@/components/DocumentLocale";
import { Header } from "@/components/Header";
import { TranslationProvider } from "@/hooks/useTranslation";
import { isLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);

  return {
    title: {
      default: dictionary.brand.name,
      template: `%s · ${dictionary.brand.name}`,
    },
    description: dictionary.brand.tagline,
  };
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

  return (
    <TranslationProvider locale={locale} dictionary={dictionary}>
      <DocumentLocale />
      <div
        className={`relative isolate min-h-screen ${usesEthiopic ? "[font-family:var(--font-ethiopic),var(--font-sans),sans-serif]" : ""}`}
        lang={locale}
        data-locale={locale}
      >
        <AddisSkylineBackdrop />
        <Header />
        <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
          {children}
        </main>
      </div>
    </TranslationProvider>
  );
}
