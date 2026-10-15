import { prisma } from "@/lib/db/prisma";
import { publicCatalogListingWhere } from "@/lib/catalog/crm-public-scrape";
import { publicCatalogProjectWhere } from "@/lib/catalog/seed-public-project";

export type HomeStats = {
  liveListings: number;
  publishedProjects: number;
  verifiedDevelopers: number;
  subCities: number;
};

const EMPTY_STATS: HomeStats = {
  liveListings: 0,
  publishedProjects: 0,
  verifiedDevelopers: 0,
  subCities: 0,
};

/**
 * Homepage counters — same public sets as the directory pages.
 * Must never crash the page when Postgres is unreachable.
 */
export async function fetchHomeStats(): Promise<{
  stats: HomeStats;
  unavailable: boolean;
}> {
  try {
    const [liveListings, publishedProjects, verifiedDevelopers, subCities] =
      await Promise.all([
        prisma.listing.count({ where: publicCatalogListingWhere() }),
        prisma.project.count({ where: publicCatalogProjectWhere() }),
        prisma.developerProfile.count(),
        prisma.subCity.count({ where: { isActive: true } }),
      ]);

    return {
      stats: { liveListings, publishedProjects, verifiedDevelopers, subCities },
      unavailable: false,
    };
  } catch (error) {
    console.error("[home-stats] falling back to empty stats:", error);
    return { stats: EMPTY_STATS, unavailable: true };
  }
}
