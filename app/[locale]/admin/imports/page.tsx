import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ImportSourcesPanel } from "@/components/admin/ImportSourcesPanel";
import { SalesKitImportPanel } from "@/components/admin/SalesKitImportPanel";
import { PageIntro } from "@/components/PageIntro";
import { getCurrentAdmin } from "@/lib/auth/admin";
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
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageIntro
        eyebrow={dictionary.imports.eyebrow}
        title={dictionary.imports.title}
        lede={dictionary.imports.lede}
      />
      <SalesKitImportPanel />
      <ImportSourcesPanel />
    </div>
  );
}
