import { HomeClient } from "./home-client";
import { fetchHomeStats } from "@/lib/catalog/home-stats";

/** Live market counters — render at request time. */
export const dynamic = "force-dynamic";

export default async function LocaleHomePage() {
  const stats = await fetchHomeStats();

  return <HomeClient stats={stats} />;
}
