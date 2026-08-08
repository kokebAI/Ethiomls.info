import { SiteMapBackdrop } from "@/components/SiteMapBackdrop";
import { BrandMark } from "@/components/BrandMark";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { googleOAuthConfigured } from "@/lib/auth/oauth";
import { getSession } from "@/lib/auth/session";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { hubPathForRole } from "@/lib/roles/hubs";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; mode?: string; next?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const query = await searchParams;
  const session = await getSession();
  if (session) {
    if (query.next?.startsWith("/")) {
      redirect(query.next);
    }
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    });
    redirect(`/${locale}${hubPathForRole(user?.role)}`);
  }

  return (
    <div className="relative isolate w-full py-2 sm:py-6">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[1.5rem] bg-[radial-gradient(ellipse_at_top,_rgba(217,119,6,0.22),_transparent_55%),linear-gradient(160deg,#0F172A_0%,#1E293B_55%,#0F172A_100%)] sm:rounded-[2rem]"
        aria-hidden
      />
      <SiteMapBackdrop
        variant="dark"
        className="-z-[5] rounded-[1.5rem] sm:rounded-[2rem]"
      />
      <div className="relative z-10 mx-auto w-full max-w-md px-1">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-white">{dictionary.brand.name}</p>
              <p className="text-xs leading-snug text-slate-300">
                {dictionary.auth.accessEyebrow}
              </p>
            </div>
          </div>
          <LocaleSwitcher />
        </div>

        <div className="rounded-3xl border border-white/15 bg-slate-950/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.45)] sm:p-8">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-white">
            {dictionary.auth.title}
          </h1>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-slate-300">
            {dictionary.auth.lede}
          </p>
          <div className="mt-6">
            <Suspense fallback={<p className="text-sm text-slate-300">{dictionary.common.loading}</p>}>
              <AuthPanel
                initialError={query.error ?? null}
                initialMode={query.mode === "register" ? "register" : "login"}
                googleEnabled={googleOAuthConfigured()}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
