import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Catalog reads must not crash `next build` / SSG when Postgres is unreachable
 * (common on Vercel preview builds or local builds without Docker).
 */
export async function fetchVerifiedDevelopers() {
  try {
    return await prisma.developerProfile.findMany({
      include: {
        headquartersSubCity: {
          select: { code: true, name: true },
        },
      },
      orderBy: { tradeName: "asc" },
    });
  } catch (error) {
    console.error("[catalog] fetchVerifiedDevelopers failed:", error);
    return [];
  }
}

export async function fetchPublishedProjects() {
  try {
    return await prisma.project.findMany({
      where: { status: ListingStatus.PUBLISHED },
      include: {
        developer: {
          select: { tradeName: true, displayName: true },
        },
        subCity: {
          select: { code: true, name: true },
        },
      },
      orderBy: [{ completionPercent: "desc" }, { updatedAt: "desc" }],
    });
  } catch (error) {
    console.error("[catalog] fetchPublishedProjects failed:", error);
    return [];
  }
}

export async function fetchProjectById(id: string) {
  try {
    return await prisma.project.findFirst({
      where: { id, status: ListingStatus.PUBLISHED },
      include: {
        developer: {
          select: {
            tradeName: true,
            displayName: true,
            website: true,
            registrationNumber: true,
          },
        },
        subCity: {
          select: { code: true, name: true },
        },
        listings: {
          where: { status: ListingStatus.PUBLISHED },
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });
  } catch (error) {
    console.error("[catalog] fetchProjectById failed:", error);
    return null;
  }
}

export async function fetchPublishedListings() {
  try {
    return await prisma.listing.findMany({
      where: { status: ListingStatus.PUBLISHED },
      include: {
        subCity: {
          select: { code: true, name: true },
        },
        developer: {
          select: { tradeName: true, displayName: true },
        },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
  } catch (error) {
    console.error("[catalog] fetchPublishedListings failed:", error);
    return [];
  }
}

export async function fetchActiveSubCities() {
  try {
    return await prisma.subCity.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  } catch (error) {
    console.error("[catalog] fetchActiveSubCities failed:", error);
    return [];
  }
}
