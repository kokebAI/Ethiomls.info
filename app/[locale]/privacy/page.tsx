import type { Metadata } from "next";
import { LegalProse } from "@/components/legal/LegalProse";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PRIVACY_SECTIONS } from "@/lib/legal/documents";
import { buildPageMetadata } from "@/lib/seo/build-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const copy = getDictionary(locale).legal;
  return buildPageMetadata({
    locale,
    path: "/privacy",
    title: copy.privacyTitle,
    description: copy.privacyLede,
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const copy = getDictionary(locale).legal;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex max-w-3xl flex-col gap-3">
        <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-slate-deep sm:text-4xl">
          {copy.privacyTitle}
        </h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-ink sm:text-base">
          {copy.privacyLede}
        </p>
      </header>
      <LegalProse locale={locale} copy={copy} sections={PRIVACY_SECTIONS} />
    </article>
  );
}
