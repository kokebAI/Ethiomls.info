import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RoleHubView } from "@/components/roles/RoleHubView";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
import {
  hubPathForRole,
  isRoleHubSlug,
  ROLE_HUBS,
  ROLE_HUB_SLUGS,
  type RoleHubDef,
} from "@/lib/roles/hubs";

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

function hubSlugForRole(role: string): string | null {
  const match = ROLE_HUB_SLUGS.find((slug) => ROLE_HUBS[slug].role === role);
  return match ?? null;
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
  let hub: RoleHubDef = ROLE_HUBS[slug];

  if (!dictionary.roles?.[slug]) notFound();

  const session = await getSession();
  if (!session) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/roles/${slug}`)}`,
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    select: { role: true },
  });
  if (!user) {
    redirect(`/${locale}/login`);
  }

  // Each account only opens its own hub — no browsing other roles.
  const ownSlug = hubSlugForRole(user.role);
  if (!ownSlug || slug !== ownSlug) {
    redirect(`/${locale}${hubPathForRole(user.role)}`);
  }

  if (slug === "developer") {
    const profile = await prisma.developerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    hub = {
      ...hub,
      ctas: hub.ctas.map((cta) =>
        cta.id === "myPage" && profile
          ? { ...cta, href: `/developers/${profile.id}` }
          : cta,
      ),
    };
  }

  return <RoleHubView locale={locale} hub={hub} dictionary={dictionary} />;
}
