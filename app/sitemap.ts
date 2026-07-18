import type { MetadataRoute } from "next";
import { ListingStatus } from "@prisma/client";
import { locales } from "@/lib/i18n/config";
import { prisma } from "@/lib/db/prisma";
import { absoluteUrl } from "@/lib/seo/config";

const STATIC_PATHS = [
  "",
  "/listings",
  "/projects",
  "/developers",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: absoluteUrl(`/${locale}${path}`),
        lastModified: now,
        changeFrequency: path === "" || path === "/listings" ? "daily" : "weekly",
        priority: path === "" ? 1 : path === "/listings" ? 0.9 : 0.7,
      });
    }
  }

  try {
    const [listings, projects, developers] = await Promise.all([
      prisma.listing.findMany({
        where: { status: ListingStatus.PUBLISHED },
        select: { id: true, updatedAt: true },
        take: 5000,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.project.findMany({
        where: { status: ListingStatus.PUBLISHED },
        select: { id: true, updatedAt: true },
        take: 2000,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.developerProfile.findMany({
        where: { isVerified: true },
        select: { id: true, updatedAt: true },
        take: 1000,
      }),
    ]);

    for (const locale of locales) {
      for (const listing of listings) {
        entries.push({
          url: absoluteUrl(`/${locale}/listings/${listing.id}`),
          lastModified: listing.updatedAt,
          changeFrequency: "daily",
          priority: 0.8,
        });
      }
      for (const project of projects) {
        entries.push({
          url: absoluteUrl(
            `/${locale}/projects/${encodeURIComponent(project.id)}`,
          ),
          lastModified: project.updatedAt,
          changeFrequency: "weekly",
          priority: 0.75,
        });
      }
      for (const developer of developers) {
        entries.push({
          url: absoluteUrl(`/${locale}/developers/${developer.id}`),
          lastModified: developer.updatedAt,
          changeFrequency: "weekly",
          priority: 0.65,
        });
      }
    }
  } catch (error) {
    console.error("[sitemap] catalog fetch failed:", error);
  }

  return entries;
}
