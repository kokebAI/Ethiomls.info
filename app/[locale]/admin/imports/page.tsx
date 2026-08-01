import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ImportSourcesPanel } from "@/components/admin/ImportSourcesPanel";
import { SalesKitImportPanel } from "@/components/admin/SalesKitImportPanel";
import { PageIntro } from "@/components/PageIntro";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "am") as Locale;
  const dictionary = getDictionary(locale);
  return { title: dictionary.imports.title };
}

export default async function AdminImportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "am") as Locale;
  const dictionary = getDictionary(locale);
  const staff = await getCurrentOpsStaff();

  if (!staff) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div
        role="status"
        className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
      >
        <strong className="font-semibold">Scrape hub moved to AGT CRM.</strong>{" "}
        Use{" "}
        <a
          href="https://agt-crm-chi.vercel.app/admin/imports"
          className="font-semibold underline"
          target="_blank"
          rel="noreferrer"
        >
          AGT CRM → Imports
        </a>{" "}
        and Scrape review for new Telegram / Facebook / website scrapes. Activate
        EthioMLS from CRM when a listing should enter audit. This EthioMLS page
        remains for sales kits and legacy sources until cutover is complete.
      </div>
      <PageIntro
        eyebrow={dictionary.imports.eyebrow}
        title={dictionary.imports.title}
        lede={dictionary.imports.lede}
      />
      <p className="text-sm text-ink-muted">
        <a
          href={`/${locale}/admin/scrape-review`}
          className="font-semibold text-brand-700 hover:underline"
        >
          {dictionary.scrapeReview.title}
        </a>
        {" — "}
        {dictionary.scrapeReview.lede}
      </p>
      <SalesKitImportPanel />
      <ImportSourcesPanel />
    </div>
  );
}
