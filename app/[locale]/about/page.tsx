import type { Metadata } from "next";
import { OperatorFacts } from "@/components/legal/OperatorFacts";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
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
    path: "/about",
    title: copy.aboutTitle,
    description: copy.aboutLede,
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const copy = getDictionary(locale).legal;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-slate-deep sm:text-4xl">
          {copy.aboutTitle}
        </h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-ink sm:text-base">
          {copy.aboutLede}
        </p>
      </header>
      <p
        className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
        role="note"
      >
        {copy.templateBanner}
      </p>
      <p className="text-pretty text-sm leading-relaxed text-ink sm:text-base">
        {copy.aboutBody}
      </p>
      <section className="flex flex-col gap-4" aria-labelledby="operator-facts">
        <h2
          id="operator-facts"
          className="text-balance text-xl font-bold tracking-tight text-slate-deep"
        >
          {copy.factsHeading}
        </h2>
        <OperatorFacts labels={copy} />
      </section>
    </article>
  );
}
