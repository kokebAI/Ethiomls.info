import { LogoutButton } from "@/components/auth/LogoutButton";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { HomeClient } from "./home-client";
import { getSession } from "@/lib/auth/session";
import { fetchDashboardMetrics } from "@/lib/catalog/dashboard-metrics";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";

/** Prefer request-time render — homepage uses session cookies + Prisma metrics. */
export const dynamic = "force-dynamic";

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const [metrics, session] = await Promise.all([
    fetchDashboardMetrics(),
    getSession(),
  ]);

  return (
    <HomeClient>
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
        />
      </div>
    </HomeClient>
  );
}
