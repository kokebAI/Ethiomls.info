import { ListingStatus } from "@prisma/client";

/** Fixed ids from `prisma/seed.ts` mock projects (`seed-project-*`). */
export const SEED_PROJECT_ID_PREFIX = "seed-project-";

export type SeedProjectRef = {
  id: string;
  status: string;
};

/** Seed demo projects that may appear on /projects while still PENDING_REVIEW. */
export function isPublicUnverifiedSeedProject(project: SeedProjectRef): boolean {
  if (project.status !== ListingStatus.PENDING_REVIEW) return false;
  return project.id.startsWith(SEED_PROJECT_ID_PREFIX);
}

/** Prisma `where` for public project catalog (published + seed demo pending). */
export function publicCatalogProjectWhere() {
  return {
    OR: [
      { status: ListingStatus.PUBLISHED },
      {
        status: ListingStatus.PENDING_REVIEW,
        id: { startsWith: SEED_PROJECT_ID_PREFIX },
      },
    ],
  };
}
