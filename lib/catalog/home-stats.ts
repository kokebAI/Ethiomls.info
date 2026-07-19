import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

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

/** Homepage counters — must never crash the page when Postgres is unreachable. */
export async function fetchHomeStats(): Promise<HomeStats> {
  try {
    const [liveListings, publishedProjects, verifiedDevelopers, subCities] =
      await Promise.all([
        prisma.listing.count({ where: { status: ListingStatus.PUBLISHED } }),
        prisma.project.count({ where: { status: ListingStatus.PUBLISHED } }),
        prisma.developerProfile.count({
          where: {
            isVerified: true,
            OR: [
              { listings: { some: { status: ListingStatus.PUBLISHED } } },
              { projects: { some: { status: ListingStatus.PUBLISHED } } },
            ],
          },
        }),
        prisma.subCity.count({ where: { isActive: true } }),
      ]);

    return { liveListings, publishedProjects, verifiedDevelopers, subCities };
  } catch (error) {
    console.error("[home-stats] falling back to empty stats:", error);
    return EMPTY_STATS;
  }
}
