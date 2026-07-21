import { ListingStatus, UserRole } from "@prisma/client";
import type { AdminPendingDirectoryItem } from "@/components/admin/AdminPendingQueue";
import type { DirectoryItem } from "@/components/PageDirectory";
import {
  classifyListingParty,
  partyLabelFromListing,
  type AuditPartyCategory,
} from "@/lib/admin/listing-party";
import type { Locale } from "@/lib/i18n/config";
import {
  labelEnum,
  localizedListingTitle,
  localizedSubCityName,
} from "@/lib/i18n/enums";
import { pickLocalized } from "@/lib/i18n/pickLocalized";

export type AuditEnumMaps = {
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

export function toAuditPendingItem(
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
  enums: AuditEnumMaps,
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
    href: `/${locale}/listings/${encodeURIComponent(listing.id)}`,
    imageUrl: listing.coverImageUrl || listing.galleryImageUrls[0] || null,
    photoCount: listing.galleryImageUrls.length,
    badges,
    party,
    groupLabel,
  };
}

export function toAuditDirectoryItem(
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
  enums: AuditEnumMaps,
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
    href: `/${locale}/listings/${encodeURIComponent(listing.id)}`,
    imageUrl: listing.coverImageUrl || listing.galleryImageUrls[0] || null,
    photoCount: listing.galleryImageUrls.length,
    badges,
  };
}

export const auditPendingSelect = {
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

export const auditReadySelect = {
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
