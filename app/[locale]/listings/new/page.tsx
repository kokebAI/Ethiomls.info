import { redirect } from "next/navigation";
import { PropertyForm } from "@/src/components/PropertyForm";
import { getSession } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  return (
    <main className="relative z-10 px-4 py-10 sm:px-6 lg:py-16">
      <PropertyForm ownerId={session.userId} />
    </main>
  );
}
