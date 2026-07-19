import type { Metadata } from "next";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { getSession } from "@/lib/auth/session";
import { fetchDashboardMetrics } from "@/lib/catalog/dashboard-metrics";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";

/** Session cookies + live Prisma metrics — always render at request time. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  return { title: dictionary.dashboard.title };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const [session, admin] = await Promise.all([getSession(), getCurrentAdmin()]);
  const isAdmin = Boolean(admin);
  const metrics = await fetchDashboardMetrics({ includeAdmin: isAdmin });

  return (
    <div className="flex flex-col gap-4">
      {session ? (
        <div className="flex justify-end">
          <LogoutButton />
        </div>
      ) : null}
      <DashboardMetrics
        dictionary={dictionary}
        metrics={metrics}
        welcomeName={session?.fullName ?? null}
        isAdmin={isAdmin}
      />
    </div>
  );
}
