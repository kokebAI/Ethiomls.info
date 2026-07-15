import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
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

  return (
    <TranslationProvider locale={locale} dictionary={dictionary}>
      <div className="app-shell" lang={locale} data-locale={locale}>
        <Header />
        <main className="app-main">{children}</main>
      </div>
    </TranslationProvider>
  );
}
