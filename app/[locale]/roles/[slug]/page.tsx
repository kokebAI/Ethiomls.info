import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleHubView } from "@/components/roles/RoleHubView";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/getDictionary";
import { isRoleHubSlug, ROLE_HUBS, ROLE_HUB_SLUGS } from "@/lib/roles/hubs";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return ROLE_HUB_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = (isLocale(raw) ? raw : "am") as Locale;
  const dictionary = getDictionary(locale);
  if (!isRoleHubSlug(slug)) return { title: "Role" };
  const copy = dictionary.roles?.[slug];
  return {
    title: copy?.title ?? slug,
    description: copy?.lede,
  };
}

export default async function RoleHubPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = (isLocale(raw) ? raw : "am") as Locale;

  if (!isRoleHubSlug(slug)) notFound();

  const dictionary = getDictionary(locale);
  const hub = ROLE_HUBS[slug];
  const t = (key: string) => translate(dictionary, key);

  if (!dictionary.roles?.[slug]) notFound();

  return (
    <RoleHubView locale={locale} hub={hub} dictionary={dictionary} t={t} />
  );
}
