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
import {
  labelEnum,
  localizedListingTitle,
  localizedSubCityName,
} from "@/lib/i18n/enums";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { pickLocalized } from "@/lib/i18n/pickLocalized";

export const dynamic = "force-dynamic";

type EnumMaps = {
  listingStatus: Record<string, string>;
  listingType: Record<string, string>;
  listingFallback: string;
  groupOther: string;
  auditPassed: string;
};

function delalaDisplayName(
  displayName: unknown,
  locale: Locale,
): string | null {
  const label = pickLocalized(
    displayName as Parameters<typeof pickLocalized>[0],
    locale,
  ).trim();
  return label || null;
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
  locale: Locale,
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
  enums: EnumMaps,
): AdminPendingDirectoryItem {
  const subCityName = localizedSubCityName(listing.subCity, locale);

  const party = classifyListingParty({
    developerId: listing.developerId,
    delalaId: listing.delalaId,
    metadataTags: listing.metadataTags,
    ownerRole: listing.owner.role,
  });

  const partyName = partyLabelFromListing({
    developerTradeName: listing.developer?.tradeName,
    delalaDisplayName: delalaDisplayName(listing.delala?.displayName, locale),
    ownerFullName: listing.owner.fullName,
    ownerRole: listing.owner.role,
  });

  const groupLabel =
    listing.developer?.tradeName?.trim() ||
    delalaDisplayName(listing.delala?.displayName, locale) ||
    listing.owner.fullName?.trim() ||
    enums.groupOther;

  const badges: DirectoryItem["badges"] = [
    {
      label: labelEnum(enums.listingStatus, listing.status),
      tone: "amber",
    },
    {
      label: partyBadgeLabel(party, partyLabels),
      tone: partyBadgeTone(party),
    },
  ];

  return {
    id: listing.id,
    title: localizedListingTitle(
      listing,
      locale,
      enums.listingFallback,
    ),
    meta: [
      partyName,
      listing.id,
      labelEnum(enums.listingType, listing.listingType),
      subCityName,
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/${locale}/listings/${listing.id}`,
    imageUrl: listing.coverImageUrl || listing.galleryImageUrls[0] || null,
    photoCount: listing.galleryImageUrls.length,
    badges,
    party,
    groupLabel,
  };
}

function toDirectoryItem(
  locale: Locale,
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
  enums: EnumMaps,
  badgeExtra?: string,
): DirectoryItem {
  const subCityName = localizedSubCityName(listing.subCity, locale);

  const badges: DirectoryItem["badges"] = [
    {
      label: labelEnum(enums.listingStatus, listing.status),
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
    title: localizedListingTitle(
      listing,
      locale,
      enums.listingFallback,
    ),
    meta: [
      listing.id,
      labelEnum(enums.listingType, listing.listingType),
      subCityName,
    ]
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

  const enums: EnumMaps = {
    listingStatus: dictionary.enums?.listingStatus ?? {},
    listingType: dictionary.enums?.listingType ?? {},
    listingFallback: ws.listingFallback ?? "Listing",
    groupOther: ws.groupOther ?? "Other",
    auditPassed: ws.auditPassed ?? "Audit passed",
  };

  const [
    pendingCount,
    pendingProjectCount,
    unreadAlertCount,
    readyCount,
    pending,
    pendingProjects,
    drafts,
    ready,
    alertRows,
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
    prisma.project.findMany({
      where: {
        status: { in: [ListingStatus.PENDING_REVIEW, ListingStatus.DRAFT] },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        status: true,
        coverImageUrl: true,
        galleryImageUrls: true,
        adminAuditApprovedAt: true,
        developer: { select: { tradeName: true } },
        subCity: { select: { code: true, name: true } },
      },
    }),
    prisma.listing.findMany({
      where: { status: ListingStatus.DRAFT },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: readySelect,
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
        pendingProjectCount={pendingProjectCount}
        unreadAlertCount={unreadAlertCount}
        readyCount={readyCount}
        pendingItems={pending.map((listing) =>
          toPendingItem(locale, listing, partyLabels, enums),
        )}
        pendingProjectItems={pendingProjects.map((project) => {
          const title =
            pickLocalized(
              project.title as Parameters<typeof pickLocalized>[0],
              locale,
            ) || project.id;
          const subCity = project.subCity
            ? localizedSubCityName(project.subCity, locale)
            : null;
          const cover =
            project.coverImageUrl || project.galleryImageUrls[0] || null;
          return {
            id: project.id,
            href: `/${locale}/projects/${encodeURIComponent(project.id)}`,
            title,
            description: [project.developer.tradeName, subCity]
              .filter(Boolean)
              .join(" · "),
            imageUrl: cover,
            badges: [
              {
                label:
                  enums.listingStatus[project.status] ?? project.status,
                tone: project.adminAuditApprovedAt ? "emerald" : "amber",
              },
              ...(project.adminAuditApprovedAt
                ? [{ label: enums.auditPassed, tone: "emerald" as const }]
                : []),
            ],
          };
        })}
        draftItems={drafts.map((listing) =>
          toDirectoryItem(locale, listing, enums),
        )}
        readyItems={ready.map((listing) =>
          toDirectoryItem(locale, listing, enums, enums.auditPassed),
        )}
        alerts={alerts}
        copy={{
          snapshotTitle: ws.snapshotTitle,
          snapshotPending: ws.snapshotPending,
          snapshotPendingProjects: ws.snapshotPendingProjects,
          snapshotAlerts: ws.snapshotAlerts,
          snapshotReady: ws.snapshotReady,
          addListing: ws.addListing ?? "Add listing",
          addListingHint:
            ws.addListingHint ??
            "Goes to pending review — audit and verify after.",
          pendingTitle: ws.pendingTitle,
          pendingEmpty: ws.pendingEmpty,
          pendingProjectsTitle: ws.pendingProjectsTitle,
          pendingProjectsEmpty: ws.pendingProjectsEmpty,
          draftsTitle: ws.draftsTitle ?? "Drafts",
          draftsEmpty: ws.draftsEmpty ?? "No draft listings.",
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
