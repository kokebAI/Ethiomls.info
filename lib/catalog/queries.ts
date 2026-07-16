import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function fetchVerifiedDevelopers() {
  return prisma.developerProfile.findMany({
    include: {
      headquartersSubCity: {
        select: { code: true, name: true },
      },
    },
    orderBy: { tradeName: "asc" },
  });
}

export async function fetchPublishedProjects() {
  return prisma.project.findMany({
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
}

export async function fetchProjectById(id: string) {
  return prisma.project.findFirst({
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
}

export async function fetchPublishedListings() {
  return prisma.listing.findMany({
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
}

export async function fetchActiveSubCities() {
  return prisma.subCity.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}
