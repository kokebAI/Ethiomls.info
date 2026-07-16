import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

function localizedCoverage(title: unknown, description: unknown): boolean {
  const locales = ["en", "am", "om", "ti"] as const;
  const read = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const t = read(title);
  const d = read(description);
  if (!t || !d) return false;
  return locales.every(
    (code) =>
      typeof t[code] === "string" &&
      String(t[code]).trim().length > 0 &&
      typeof d[code] === "string" &&
      String(d[code]).trim().length > 0,
  );
}

export type DashboardMetricsData = {
  activeListings: number;
  pendingApprovals: number;
  translationRate: number;
};

export async function fetchDashboardMetrics(): Promise<DashboardMetricsData> {
  const [activeCount, pendingCount, alertCount, listingsForCoverage] =
    await Promise.all([
      prisma.listing.count({
        where: {
          status: ListingStatus.PUBLISHED,
          subCity: { isActive: true },
        },
      }),
      prisma.listing.count({
        where: { status: ListingStatus.PENDING_REVIEW },
      }),
      prisma.adminAlert.count({
        where: { isRead: false },
      }),
      prisma.listing.findMany({
        select: { title: true, description: true },
        take: 500,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

  const covered = listingsForCoverage.filter((row) =>
    localizedCoverage(row.title, row.description),
  ).length;
  const translationRate =
    listingsForCoverage.length === 0
      ? 0
      : Math.round((covered / listingsForCoverage.length) * 100);

  return {
    activeListings: activeCount,
    pendingApprovals: pendingCount + alertCount,
    translationRate,
  };
}
