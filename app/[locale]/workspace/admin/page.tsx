import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListingStatus, UserRole } from "@prisma/client";
import {
  AdminWorkspaceView,
  type AdminAlertItem,
} from "@/components/admin/AdminWorkspaceView";
import type { AdminPendingDirectoryItem } from "@/components/admin/AdminPendingQueue";
import type { DirectoryItem } from "@/components/PageDirectory";
import {
  classifyListingParty,
  partyLabelFromListing,
  type AuditPartyCategory,
} from "@/lib/admin/listing-party";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";

export const dynamic = "force-dynamic";

function listingTitle(listing: {
  titleEn: string | null;
  title: unknown;
}): string {
  if (listing.titleEn?.trim()) return listing.titleEn.trim();
  if (
    listing.title &&
    typeof listing.title === "object" &&
    listing.title !== null &&
    "en" in listing.title
  ) {
    const en = (listing.title as { en?: string }).en;
    if (en?.trim()) return en.trim();
  }
  return "Listing";
}

function delalaDisplayName(displayName: unknown): string | null {
  if (
    displayName &&
    typeof displayName === "object" &&
    displayName !== null &&
    "en" in displayName
  ) {
    const en = (displayName as { en?: string }).en;
    return en?.trim() || null;
  }
  return null;
}

function partyBadgeTone(
  party: AuditPartyCategory,
): NonNullable<DirectoryItem["badges"]>[number]["tone"] {
  switch (party) {
    case "developers":
      return "violet";
    case "brokers":
      return "sky";
    case "owners":
      return "emerald";
    case "imported":
      return "amber";
    default:
      return "slate";
  }
}

function partyBadgeLabel(
  party: AuditPartyCategory,
  labels: Record<AuditPartyCategory, string>,
): string {
  return labels[party];
}

function toPendingItem(
  locale: string,
  listing: {
    id: string;
    titleEn: string | null;
    title: unknown;
    status: ListingStatus;
    listingType: string;
    coverImageUrl: string | null;
    galleryImageUrls: string[];
    metadataTags: string[];
    developerId: string | null;
    delalaId: string | null;
    subCity: { name: unknown } | null;
    owner: { fullName: string; role: UserRole };
    developer: { tradeName: string } | null;
    delala: { displayName: unknown } | null;
  },
  partyLabels: Record<AuditPartyCategory, string>,
): AdminPendingDirectoryItem {
  const subCityName =
    listing.subCity?.name &&
    typeof listing.subCity.name === "object" &&
    listing.subCity.name !== null &&
    "en" in listing.subCity.name
      ? String((listing.subCity.name as { en?: string }).en ?? "")
      : "";

  const party = classifyListingParty({
    developerId: listing.developerId,
    delalaId: listing.delalaId,
    metadataTags: listing.metadataTags,
    ownerRole: listing.owner.role,
  });

  const partyName = partyLabelFromListing({
    developerTradeName: listing.developer?.tradeName,
    delalaDisplayName: delalaDisplayName(listing.delala?.displayName),
    ownerFullName: listing.owner.fullName,
    ownerRole: listing.owner.role,
  });

  const badges: DirectoryItem["badges"] = [
    {
      label: listing.status.replaceAll("_", " "),
      tone: "amber",
    },
    {
      label: partyBadgeLabel(party, partyLabels),
      tone: partyBadgeTone(party),
    },
  ];

  return {
    id: listing.id,
    title: listingTitle(listing),
    meta: [
      partyName,
      listing.id,
      listing.listingType.replaceAll("_", " "),
      subCityName,
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/${locale}/listings/${listing.id}`,
    imageUrl: listing.coverImageUrl || listing.galleryImageUrls[0] || null,
    photoCount: listing.galleryImageUrls.length,
    badges,
    party,
  };
}

function toDirectoryItem(
  locale: string,
  listing: {
    id: string;
    titleEn: string | null;
    title: unknown;
    status: ListingStatus;
    listingType: string;
    coverImageUrl: string | null;
    galleryImageUrls: string[];
    subCity: { name: unknown } | null;
  },
  badgeExtra?: string,
): DirectoryItem {
  const subCityName =
    listing.subCity?.name &&
    typeof listing.subCity.name === "object" &&
    listing.subCity.name !== null &&
    "en" in listing.subCity.name
      ? String((listing.subCity.name as { en?: string }).en ?? "")
      : "";

  const badges: DirectoryItem["badges"] = [
    {
      label: listing.status.replaceAll("_", " "),
      tone:
        listing.status === ListingStatus.PUBLISHED
          ? "emerald"
          : listing.status === ListingStatus.PENDING_REVIEW
            ? "amber"
            : "slate",
    },
  ];
  if (badgeExtra) {
    badges.push({ label: badgeExtra, tone: "emerald" });
  }

  return {
    id: listing.id,
    title: listingTitle(listing),
    meta: [listing.id, listing.listingType.replaceAll("_", " "), subCityName]
      .filter(Boolean)
      .join(" · "),
    href: `/${locale}/listings/${listing.id}`,
    imageUrl: listing.coverImageUrl || listing.galleryImageUrls[0] || null,
    photoCount: listing.galleryImageUrls.length,
    badges,
  };
}

const pendingSelect = {
  id: true,
  titleEn: true,
  title: true,
  status: true,
  listingType: true,
  coverImageUrl: true,
  galleryImageUrls: true,
  metadataTags: true,
  developerId: true,
  delalaId: true,
  adminAuditApprovedAt: true,
  subCity: { select: { name: true } },
  owner: { select: { fullName: true, role: true } },
  developer: { select: { tradeName: true } },
  delala: { select: { displayName: true } },
} as const;

const readySelect = {
  id: true,
  titleEn: true,
  title: true,
  status: true,
  listingType: true,
  coverImageUrl: true,
  galleryImageUrls: true,
  adminAuditApprovedAt: true,
  subCity: { select: { name: true } },
} as const;

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

  const partyLabels: Record<AuditPartyCategory, string> = {
    developers: ws.partyDevelopers ?? "Developers",
    brokers: ws.partyBrokers ?? "Brokers",
    owners: ws.partyOwners ?? "Owners",
    imported: ws.partyImported ?? "Imported",
  };

  const [
    pendingCount,
    unreadAlertCount,
    readyCount,
    pending,
    ready,
    alertRows,
  ] = await Promise.all([
    prisma.listing.count({
      where: {
        status: ListingStatus.PENDING_REVIEW,
        adminAuditApprovedAt: null,
      },
    }),
    prisma.adminAlert.count({ where: { isRead: false } }),
    prisma.listing.count({
      where: {
        status: ListingStatus.PENDING_REVIEW,
        adminAuditApprovedAt: { not: null },
      },
    }),
    prisma.listing.findMany({
      where: {
        status: ListingStatus.PENDING_REVIEW,
        adminAuditApprovedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: pendingSelect,
    }),
    prisma.listing.findMany({
      where: {
        status: ListingStatus.PENDING_REVIEW,
        adminAuditApprovedAt: { not: null },
      },
      orderBy: { adminAuditApprovedAt: "desc" },
      take: 12,
      select: readySelect,
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
        pendingCount={pendingCount}
        unreadAlertCount={unreadAlertCount}
        readyCount={readyCount}
        pendingItems={pending.map((listing) =>
          toPendingItem(locale, listing, partyLabels),
        )}
        readyItems={ready.map((listing) =>
          toDirectoryItem(locale, listing, "Audit passed"),
        )}
        alerts={alerts}
        copy={{
          eyebrow: ws.eyebrow,
          title: ws.title,
          lede: ws.lede,
          motto: dictionary.brand.motto,
          openQueue: ws.openQueue,
          importSources: ws.importSources,
          dashboard: ws.dashboard,
          accountProfile: ws.accountProfile,
          snapshotTitle: ws.snapshotTitle,
          snapshotPending: ws.snapshotPending,
          snapshotAlerts: ws.snapshotAlerts,
          snapshotReady: ws.snapshotReady,
          checklistTitle: ws.checklistTitle,
          checklistLede: ws.checklistLede,
          checklistItems: [
            ws.checkSellerIdentity,
            ws.checkOwnership,
            ws.checkPrice,
            ws.checkLocation,
            ws.checkMedia,
            ws.checkPermit,
            ws.checkEscrow,
            ws.checkContact,
            ws.checkDuplicate,
          ],
          pendingTitle: ws.pendingTitle,
          pendingEmpty: ws.pendingEmpty,
          readyTitle: ws.readyTitle,
          readyEmpty: ws.readyEmpty,
          alertsTitle: ws.alertsTitle,
          alertsEmpty: ws.alertsEmpty,
          partyAll: ws.partyAll ?? "All",
          partyDevelopers: partyLabels.developers,
          partyBrokers: partyLabels.brokers,
          partyOwners: partyLabels.owners,
          partyImported: partyLabels.imported,
          partyEmpty: ws.partyEmpty ?? "No listings in this category.",
        }}
      />
    </main>
  );
}
