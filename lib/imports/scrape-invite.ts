import {
  ListingType,
  NotificationStatus,
  type Listing,
} from "@prisma/client";
import { normalizeEthiopiaPhone } from "@/lib/auth/otp";
import { prisma } from "@/lib/db/prisma";
import {
  resolveOrCreateRoleAccount,
  getRoleAccountByUserId,
  type RoleAccountSummary,
} from "@/lib/imports/resolve-role-account";
import {
  buildScrapeInviteMessage,
  buildScrapeInviteMessageForListings,
} from "@/lib/imports/scrape-invite-message";
import { smsNotificationEngine } from "@/src/services/sms.service";

export type ScrapeInviteListing = Pick<
  Listing,
  | "id"
  | "titleEn"
  | "titleAm"
  | "title"
  | "descriptionEn"
  | "descriptionAm"
  | "description"
  | "priceAmount"
  | "priceCurrency"
  | "contactPhone"
  | "contactName"
  | "addressLine"
  | "listingType"
  | "bedrooms"
  | "floorAreaSqm"
  | "notificationStatus"
  | "ownerId"
  | "developerId"
  | "delalaId"
>;

function localizedJsonField(value: unknown, locale: "en" | "am"): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const picked = record[locale] ?? record.en ?? record.am;
  return typeof picked === "string" ? picked.trim() : "";
}

function inviteRoleForListing(
  listingType: ListingType,
): "CORPORATE_DEVELOPER" | "INDEPENDENT_DELALA" {
  return listingType === ListingType.OFF_PLAN
    ? "CORPORATE_DEVELOPER"
    : "INDEPENDENT_DELALA";
}

export function resolveInvitePhone(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("telegram:@")) return null;
  return normalizeEthiopiaPhone(trimmed);
}

export { buildScrapeInviteMessage, buildScrapeInviteMessageForListings };

/**
 * Resolve or create a developer (OFF_PLAN) / broker (SALE|RENT) from the
 * listing contact phone, then attach them as owner of the listing.
 */
export async function ensureInvitePartyAttached(
  listingId: string,
): Promise<{
  account: RoleAccountSummary;
  created: boolean;
  listing: ScrapeInviteListing;
}> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing) throw new Error("Listing not found");

  const phone = resolveInvitePhone(listing.contactPhone);
  if (!phone) {
    throw new Error("No valid E.164 contact phone to create a role account");
  }

  // Already linked to a party account with this phone — keep it.
  if (listing.developerId || listing.delalaId) {
    const existing = await getRoleAccountByUserId(listing.ownerId);
    if (existing?.phone === phone) {
      return { account: existing, created: false, listing };
    }
  }

  const titleHint =
    (listing.titleEn ?? "").trim() ||
    localizedJsonField(listing.title, "en") ||
    localizedJsonField(listing.title, "am") ||
    listing.contactName?.trim() ||
    "Imported listing contact";

  const role = inviteRoleForListing(listing.listingType);
  const { account, created } = await resolveOrCreateRoleAccount({
    role,
    phone,
    fullName: listing.contactName?.trim() || titleHint.slice(0, 80),
    tradeName:
      role === "CORPORATE_DEVELOPER"
        ? listing.contactName?.trim() || titleHint.slice(0, 120)
        : undefined,
  });

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      ownerId: account.userId,
      developerId: account.developerId,
      delalaId: account.delalaId,
      contactPhone: phone,
      contactName: account.label,
      metadataTags: [
        ...new Set([
          ...listing.metadataTags,
          "invite-party-attached",
          created ? "invite-party-created" : "invite-party-existing",
          `role:${role.toLowerCase()}`,
        ]),
      ],
    },
  });

  return { account, created, listing: updated };
}

/**
 * Dispatch HaHu invite SMS for a scraped listing (single-listing wrapper).
 */
export async function sendScrapeInvite(listingId: string): Promise<{
  ok: boolean;
  listing: ScrapeInviteListing;
  messagePreview: string;
  account?: RoleAccountSummary;
  accountCreated?: boolean;
  error?: string;
  sentListingIds?: string[];
}> {
  const result = await sendScrapeInviteForPhoneGroup([listingId]);
  const primary =
    result.listings.find((listing) => listing.id === listingId) ??
    result.listings[0];
  if (!primary) {
    throw new Error("Listing not found");
  }
  return {
    ok: result.ok,
    listing: primary,
    messagePreview: result.messagePreview,
    account: result.account,
    accountCreated: result.accountCreated,
    error: result.error,
    sentListingIds: result.sentListingIds,
  };
}

const INVITE_ELIGIBLE_STATUSES = new Set<NotificationStatus>([
  NotificationStatus.PENDING_REVIEW,
  NotificationStatus.FAILED,
  NotificationStatus.NOT_APPLICABLE,
]);

/**
 * One HaHu SMS per phone: attach all listings, send combined message, mark all SENT/FAILED.
 */
export async function sendScrapeInviteForPhoneGroup(
  listingIds: string[],
): Promise<{
  ok: boolean;
  listings: ScrapeInviteListing[];
  messagePreview: string;
  account?: RoleAccountSummary;
  accountCreated?: boolean;
  error?: string;
  sentListingIds: string[];
}> {
  const uniqueIds = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new Error("At least one listingId is required");
  }

  const rows = await prisma.listing.findMany({
    where: { id: { in: uniqueIds } },
  });
  if (rows.length !== uniqueIds.length) {
    throw new Error("One or more listings were not found");
  }

  const discarded = rows.find(
    (row) => row.notificationStatus === NotificationStatus.DISCARDED,
  );
  if (discarded) {
    throw new Error(`Listing ${discarded.id} was discarded`);
  }

  const ineligible = rows.find(
    (row) => !INVITE_ELIGIBLE_STATUSES.has(row.notificationStatus),
  );
  if (ineligible) {
    throw new Error(
      `Listing ${ineligible.id} is not in the invite queue (${ineligible.notificationStatus})`,
    );
  }

  const phones = rows.map((row) => resolveInvitePhone(row.contactPhone));
  const primaryPhone = phones.find(Boolean);
  if (!primaryPhone) {
    const messagePreview = buildScrapeInviteMessageForListings(rows);
    await prisma.listing.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        notificationStatus: NotificationStatus.FAILED,
        notificationError: "No valid E.164 contact phone for HaHu invite",
      },
    });
    return {
      ok: false,
      listings: rows,
      messagePreview,
      error: "No valid E.164 contact phone for HaHu invite",
      sentListingIds: [],
    };
  }

  if (phones.some((phone) => phone && phone !== primaryPhone)) {
    throw new Error("All listings in a group must share the same contact phone");
  }

  let account: RoleAccountSummary | undefined;
  let accountCreated = false;
  const workingListings: ScrapeInviteListing[] = [];

  try {
    for (const listingId of uniqueIds) {
      const attached = await ensureInvitePartyAttached(listingId);
      if (!account) {
        account = attached.account;
        accountCreated = attached.created;
      }
      workingListings.push(attached.listing);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not attach role account";
    await prisma.listing.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        notificationStatus: NotificationStatus.FAILED,
        notificationError: message,
      },
    });
    return {
      ok: false,
      listings: rows,
      messagePreview: buildScrapeInviteMessageForListings(rows),
      error: message,
      sentListingIds: [],
    };
  }

  const messagePreview = buildScrapeInviteMessageForListings(workingListings);

  const result = await smsNotificationEngine.sendRaw({
    toE164: primaryPhone,
    body: messagePreview,
    locale: "am",
  });

  if (result.ok) {
    const sentAt = new Date();
    await prisma.listing.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        notificationStatus: NotificationStatus.SENT,
        notificationSentAt: sentAt,
        notificationError: null,
      },
    });
    const updated = await prisma.listing.findMany({
      where: { id: { in: uniqueIds } },
    });
    return {
      ok: true,
      listings: updated,
      messagePreview,
      account,
      accountCreated,
      sentListingIds: uniqueIds,
    };
  }

  const failMessage = result.error ?? "HaHu dispatch failed";
  await prisma.listing.updateMany({
    where: { id: { in: uniqueIds } },
    data: {
      notificationStatus: NotificationStatus.FAILED,
      notificationError: failMessage,
    },
  });
  const updated = await prisma.listing.findMany({
    where: { id: { in: uniqueIds } },
  });
  return {
    ok: false,
    listings: updated,
    messagePreview,
    account,
    accountCreated,
    error: failMessage,
    sentListingIds: [],
  };
}

export function resolveAutoSendFlag(input: {
  searchParams?: URLSearchParams;
  body?: Record<string, unknown> | null;
  envDefault?: boolean;
}): boolean {
  const mode =
    input.searchParams?.get("mode") ??
    (typeof input.body?.mode === "string" ? input.body.mode : null);
  if (mode === "auto") return true;
  if (mode === "manual") return false;

  if (typeof input.body?.autoSend === "boolean") return input.body.autoSend;
  if (typeof input.body?.autoSend === "string") {
    const v = input.body.autoSend.toLowerCase();
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
  }

  const queryAuto = input.searchParams?.get("autoSend");
  if (queryAuto === "true" || queryAuto === "1") return true;
  if (queryAuto === "false" || queryAuto === "0") return false;

  if (typeof input.envDefault === "boolean") return input.envDefault;
  const env = (process.env.SCRAPE_AUTO_SEND ?? "").toLowerCase();
  return env === "true" || env === "1";
}
