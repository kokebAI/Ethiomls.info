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
        <strong className="font-semibold">
          EthioMLS scrapes push to AGT CRM Review
        </strong>{" "}
        (not live mls.et). Review:{" "}
        <a
          href="https://agtplc.et/agent/leads/review"
          className="font-semibold underline"
          target="_blank"
          rel="noreferrer"
        >
          agent leads
        </a>
        {" · "}
        <a
          href="https://agtplc.et/admin/scrape-review"
          className="font-semibold underline"
          target="_blank"
          rel="noreferrer"
        >
          admin scrape-review
        </a>
        . Sources:{" "}
        <a
          href="https://agtplc.et/admin/imports"
          className="font-semibold underline"
          target="_blank"
          rel="noreferrer"
        >
          CRM Imports
        </a>
        . This page remains for sales kits and legacy local sources.
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
