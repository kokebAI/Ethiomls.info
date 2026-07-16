import { AddisSkylineBackdrop } from "@/components/AddisSkylineBackdrop";
import { BrandMark } from "@/components/BrandMark";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { googleOAuthConfigured } from "@/lib/auth/oauth";
import { getSession } from "@/lib/auth/session";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { redirect } from "next/navigation";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const query = await searchParams;
  const session = await getSession();
  if (session) {
    redirect(`/${locale}`);
  }

  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden rounded-[2rem] py-6">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(217,119,6,0.22),_transparent_55%),linear-gradient(160deg,#0F172A_0%,#1E293B_55%,#0F172A_100%)]"
        aria-hidden
      />
      <AddisSkylineBackdrop variant="dark" className="-z-[5]" />
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <div>
              <p className="font-bold text-white">{dictionary.brand.name}</p>
              <p className="text-xs text-slate-300">{dictionary.auth.accessEyebrow}</p>
            </div>
          </div>
          <LocaleSwitcher />
        </div>

        <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-white">
            {dictionary.auth.title}
          </h1>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-slate-300">
            {dictionary.auth.lede}
          </p>
          <div className="mt-6">
            <AuthPanel
              googleEnabled={googleOAuthConfigured()}
              initialError={query.error ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
