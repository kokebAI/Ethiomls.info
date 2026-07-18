import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { getSession } from "@/lib/auth/session";
import { roleLabelKey } from "@/lib/auth/signup-roles";
import { prisma } from "@/lib/db/prisma";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/getDictionary";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  return { title: dictionary.profile.title };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { fullName: true, email: true, phone: true, role: true },
  });

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const roleLabel = translate(dictionary, roleLabelKey(user.role));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
          {dictionary.profile.eyebrow}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-deep sm:text-3xl">
              {dictionary.profile.title}
            </h1>
            <p className="mt-1 max-w-xl text-pretty text-sm text-ink-muted">
              {dictionary.profile.lede}
            </p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
        <ProfileForm
          initialFullName={user.fullName}
          initialEmail={user.email}
          phone={user.phone}
          roleLabel={roleLabel}
        />
      </section>
    </div>
  );
}
