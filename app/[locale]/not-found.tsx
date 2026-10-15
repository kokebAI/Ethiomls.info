import Link from "next/link";
import { headers } from "next/headers";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function LocaleNotFound() {
  const headerStore = await headers();
  const raw = headerStore.get("x-ethiomls-locale") ?? defaultLocale;
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;
  const copy = getDictionary(locale).notFound;

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4 py-10">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-deep">
        {copy.title}
      </h1>
      <p className="text-pretty text-sm leading-relaxed text-ink-muted">
        {copy.body}
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href={`/${locale}`}
          className="rounded-xl bg-slate-deep px-4 py-2.5 text-sm font-semibold text-white"
        >
          {copy.home}
        </Link>
        <Link
          href={`/${locale}/listings`}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-deep"
        >
          {copy.listings}
        </Link>
      </div>
    </section>
  );
}
