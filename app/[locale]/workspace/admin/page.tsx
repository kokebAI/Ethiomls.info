import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListingStatus, NotificationStatus } from "@prisma/client";
import {
  AdminWorkspaceView,
  type AdminAlertItem,
} from "@/components/admin/AdminWorkspaceView";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { fetchDashboardMetrics } from "@/lib/catalog/dashboard-metrics";
import { prisma } from "@/lib/db/prisma";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { collectIntegrationStatuses } from "@/lib/ops/integration-status";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const copy = dictionary.workspace?.admin;
  return {
    title: copy?.title ?? "Admin workspace",
    description: copy?.lede,
  };
}

export default async function AdminWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/workspace/admin`)}`,
    );
  }

  const dictionary = getDictionary(locale);
  const ws = dictionary.workspace?.admin;
  if (!ws) {
    redirect(`/${locale}/roles/admin`);
  }

  const [
    pendingCount,
    pendingProjectCount,
    scrapeInviteCount,
    unreadAlertCount,
    readyCount,
    alertRows,
    integrations,
    metrics,
  ] = await Promise.all([
    prisma.listing.count({
      where: {
        status: ListingStatus.PENDING_REVIEW,
        adminAuditApprovedAt: null,
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
        status: ListingStatus.PENDING_REVIEW,
        AND: [
          {
            OR: [
              {
                notificationStatus: {
                  in: [
                    NotificationStatus.PENDING_REVIEW,
                    NotificationStatus.FAILED,
                  ],
                },
              },
              {
                notificationStatus: NotificationStatus.NOT_APPLICABLE,
                OR: [
                  { importSourceId: { not: null } },
                  { scrapedRawText: { not: null } },
                  { metadataTags: { has: "import" } },
                  { metadataTags: { has: "sales-kit-import" } },
                ],
              },
            ],
          },
          {
            OR: [
              { scrapedRawText: { not: null } },
              { importSourceId: { not: null } },
              { sourceUrl: { not: null } },
              { metadataTags: { has: "import" } },
              { metadataTags: { has: "sales-kit-import" } },
            ],
          },
        ],
      },
    }),
    prisma.adminAlert.count({ where: { isRead: false } }),
    prisma.listing.count({
      where: {
        status: ListingStatus.PENDING_REVIEW,
        adminAuditApprovedAt: { not: null },
      },
    }),
    prisma.adminAlert.findMany({
      where: { isRead: false },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        message: true,
        severity: true,
        listingId: true,
        createdAt: true,
      },
    }),
    collectIntegrationStatuses(),
    fetchDashboardMetrics({ includeAdmin: true }),
  ]);

  const alerts: AdminAlertItem[] = alertRows.map((alert) => ({
    id: alert.id,
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
    listingId: alert.listingId,
    createdAtLabel: alert.createdAt.toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  }));

  return (
    <main>
      <AdminWorkspaceView
        locale={locale}
        dictionary={dictionary}
        metrics={metrics}
        welcomeName={admin.fullName}
        integrations={integrations}
        pendingCount={pendingCount}
        pendingProjectCount={pendingProjectCount}
        scrapeInviteCount={scrapeInviteCount}
        unreadAlertCount={unreadAlertCount}
        readyCount={readyCount}
        alerts={alerts}
        copy={{
          snapshotTitle: ws.snapshotTitle,
          snapshotPending: ws.snapshotPending,
          snapshotPendingProjects: ws.snapshotPendingProjects,
          snapshotScrapeInvites: ws.snapshotScrapeInvites,
          snapshotAlerts: ws.snapshotAlerts,
          snapshotReady: ws.snapshotReady,
          integrationsTitle: ws.integrationsTitle,
          integrationsOpsTitle: ws.integrationsOpsTitle,
          integrationsRefresh: ws.integrationsRefresh,
          integrationsRefreshing: ws.integrationsRefreshing,
          addListing: ws.addListing ?? "Add listing",
          addListingHint:
            ws.addListingHint ??
            "Goes to pending review — audit and verify after.",
          assistantsLink: ws.tabStaff ?? dictionary.nav?.assistants,
          tabOverview: ws.tabOverview,
          tabStaff: ws.tabStaff,
          tabAlerts: ws.tabAlerts,
          alertsTitle: ws.alertsTitle,
          alertsEmpty: ws.alertsEmpty,
        }}
      />
    </main>
  );
}
