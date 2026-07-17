import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { ROLE_HUB_SLUGS, ROLE_HUBS } from "@/lib/roles/hubs";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "am") as Locale;
  const dictionary = getDictionary(locale);
  return {
    title: dictionary.rolesIndex?.title ?? "Roles",
    description: dictionary.rolesIndex?.lede,
  };
}

export default async function RolesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "am") as Locale;
  const dictionary = getDictionary(locale);
  const base = `/${locale}`;

  return (
    <PageIntro
      eyebrow={dictionary.brand.name}
      title={dictionary.rolesIndex?.title ?? "Choose your role"}
      lede={
        dictionary.rolesIndex?.lede ??
        "Open the hub that matches how you use EthioMLS."
      }
      motto={dictionary.brand.motto}
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_HUB_SLUGS.map((slug) => {
          const copy = dictionary.roles?.[slug];
          const hub = ROLE_HUBS[slug];
          return (
            <li key={slug}>
              <Link
                href={`${base}/roles/${hub.slug}`}
                className="block h-full rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[var(--shadow-card-hover)]"
              >
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
                  {copy?.eyebrow ?? slug}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">
                  {copy?.title ?? slug}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {copy?.lede ?? ""}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </PageIntro>
  );
}
