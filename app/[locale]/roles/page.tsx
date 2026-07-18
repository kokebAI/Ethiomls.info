import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { hubPathForRole } from "@/lib/roles/hubs";

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

/** Role chooser removed — send each account to its own hub only. */
export default async function RolesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "am") as Locale;

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    select: { role: true },
  });
  if (!user) {
    redirect(`/${locale}/login`);
  }

  redirect(`/${locale}${hubPathForRole(user.role)}`);
}
