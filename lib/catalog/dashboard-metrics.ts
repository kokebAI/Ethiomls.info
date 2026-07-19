import { ListingStatus, NotificationStatus } from "@prisma/client";
import { fetchPageViewTotals } from "@/lib/analytics/page-views";
import { prisma } from "@/lib/db/prisma";
import {
  getDeployVersion,
  type DeployVersionInfo,
} from "@/lib/ops/deploy-version";

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
  /** Full ops desk metrics — present for admins. */
  admin?: {
    listingsPublished: number;
    listingsPendingAudit: number;
    listingsDraft: number;
    listingsReady: number;
    projectsPending: number;
    unreadAlerts: number;
    scrapeInvitesPending: number;
    smsSent: number;
    smsFailed: number;
    pageViewsToday: number;
    pageViewsLast7Days: number;
    version: DeployVersionInfo;
  };
};

const EMPTY_METRICS: DashboardMetricsData = {
  activeListings: 0,
  pendingApprovals: 0,
  translationRate: 0,
};

export async function fetchDashboardMetrics(options?: {
  includeAdmin?: boolean;
}): Promise<DashboardMetricsData> {
  try {
    const [
      activeCount,
      pendingCount,
      alertCount,
      listingsForCoverage,
      adminBundle,
    ] = await Promise.all([
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
      options?.includeAdmin
        ? Promise.all([
            prisma.listing.count({
              where: { status: ListingStatus.PUBLISHED },
            }),
            prisma.listing.count({
              where: {
                status: ListingStatus.PENDING_REVIEW,
                adminAuditApprovedAt: null,
              },
            }),
            prisma.listing.count({
              where: { status: ListingStatus.DRAFT },
            }),
            prisma.listing.count({
              where: {
                status: ListingStatus.PENDING_REVIEW,
                adminAuditApprovedAt: { not: null },
              },
            }),
            prisma.project.count({
              where: {
                status: ListingStatus.PENDING_REVIEW,
                adminAuditApprovedAt: null,
              },
            }),
            prisma.listing.count({
              where: {
                notificationStatus: NotificationStatus.PENDING_REVIEW,
              },
            }),
            prisma.listing.count({
              where: { notificationStatus: NotificationStatus.SENT },
            }),
            prisma.listing.count({
              where: { notificationStatus: NotificationStatus.FAILED },
            }),
            fetchPageViewTotals(),
          ])
        : Promise.resolve(null),
    ]);

    const covered = listingsForCoverage.filter((row) =>
      localizedCoverage(row.title, row.description),
    ).length;
    const translationRate =
      listingsForCoverage.length === 0
        ? 0
        : Math.round((covered / listingsForCoverage.length) * 100);

    const base: DashboardMetricsData = {
      activeListings: activeCount,
      pendingApprovals: pendingCount + alertCount,
      translationRate,
    };

    if (!adminBundle) return base;

    const [
      listingsPublished,
      listingsPendingAudit,
      listingsDraft,
      listingsReady,
      projectsPending,
      scrapeInvitesPending,
      smsSent,
      smsFailed,
      pageViews,
    ] = adminBundle;

    return {
      ...base,
      admin: {
        listingsPublished,
        listingsPendingAudit,
        listingsDraft,
        listingsReady,
        projectsPending,
        unreadAlerts: alertCount,
        scrapeInvitesPending,
        smsSent,
        smsFailed,
        pageViewsToday: pageViews.today,
        pageViewsLast7Days: pageViews.last7Days,
        version: getDeployVersion(),
      },
    };
  } catch (error) {
    // Don't block the homepage when Postgres/pooler is slow or unreachable.
    console.error("[dashboard-metrics] falling back to empty metrics:", error);
    return EMPTY_METRICS;
  }
}
