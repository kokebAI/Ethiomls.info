import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OfficeAssistantsPanel } from "@/components/admin/OfficeAssistantsPanel";
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
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  return {
    title: dictionary.officeAssistants.title,
    description: dictionary.officeAssistants.lede,
  };
}

export default async function AdminAssistantsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/admin/assistants`)}`,
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <OfficeAssistantsPanel />
    </div>
  );
}
