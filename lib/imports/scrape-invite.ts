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

/**
 * Build a short HaHu invite SMS (≤160 chars, GSM-safe Latin script).
 * Longer Unicode Amharic bodies get truncated by the gateway.
 */
export function buildScrapeInviteMessage(
  listing: ScrapeInviteListing,
  _opts?: { accountCreated?: boolean },
): string {
  const claimLoginUrl = smsNotificationEngine.buildAbsoluteUrl(
    `/am/login?mode=reset`,
  );
  const phone =
    resolveInvitePhone(listing.contactPhone) ??
    listing.contactPhone?.trim() ??
    "";

  // Keep under 160 characters so HaHu does not cut off mid-sentence.
  const withPhone = phone
    ? `EthioMLS: Use phone ${phone}. Reset password: ${claimLoginUrl} Then sign in & edit your listing.`
    : `EthioMLS: Use your phone. Reset password: ${claimLoginUrl} Then sign in & edit your listing.`;

  if (withPhone.length <= 160) return withPhone;

  const short = `EthioMLS: Reset password: ${claimLoginUrl} Then sign in & edit listing.`;
  return short.length <= 160 ? short : short.slice(0, 160);
}

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
 * Dispatch HaHu invite SMS for a scraped listing:
 * 1) ensure developer/broker stub from phone + attach listing
 * 2) send SMS with listing + Forgot-password claim link
 * 3) flip notificationStatus
 */
export async function sendScrapeInvite(listingId: string): Promise<{
  ok: boolean;
  listing: ScrapeInviteListing;
  messagePreview: string;
  account?: RoleAccountSummary;
  accountCreated?: boolean;
  error?: string;
}> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing) {
    throw new Error("Listing not found");
  }
  if (listing.notificationStatus === NotificationStatus.DISCARDED) {
    throw new Error("Listing was discarded");
  }

  let account: RoleAccountSummary | undefined;
  let accountCreated = false;
  let workingListing: ScrapeInviteListing = listing;

  try {
    const attached = await ensureInvitePartyAttached(listingId);
    account = attached.account;
    accountCreated = attached.created;
    workingListing = attached.listing;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not attach role account";
    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        notificationStatus: NotificationStatus.FAILED,
        notificationError: message,
      },
    });
    return {
      ok: false,
      listing,
      messagePreview: buildScrapeInviteMessage(listing),
      error: message,
    };
  }

  const messagePreview = buildScrapeInviteMessage(workingListing, {
    accountCreated,
  });
  const toE164 = resolveInvitePhone(workingListing.contactPhone);
  if (!toE164) {
    await prisma.listing.update({
      where: { id: workingListing.id },
      data: {
        notificationStatus: NotificationStatus.FAILED,
        notificationError: "No valid E.164 contact phone for HaHu invite",
      },
    });
    return {
      ok: false,
      listing: workingListing,
      messagePreview,
      account,
      accountCreated,
      error: "No valid E.164 contact phone for HaHu invite",
    };
  }

  const result = await smsNotificationEngine.sendRaw({
    toE164,
    body: messagePreview,
    locale: "am",
  });

  if (result.ok) {
    const updated = await prisma.listing.update({
      where: { id: workingListing.id },
      data: {
        notificationStatus: NotificationStatus.SENT,
        notificationSentAt: new Date(),
        notificationError: null,
      },
    });
    return {
      ok: true,
      listing: updated,
      messagePreview,
      account,
      accountCreated,
    };
  }

  const updated = await prisma.listing.update({
    where: { id: workingListing.id },
    data: {
      notificationStatus: NotificationStatus.FAILED,
      notificationError: result.error ?? "HaHu dispatch failed",
    },
  });
  return {
    ok: false,
    listing: updated,
    messagePreview,
    account,
    accountCreated,
    error: result.error ?? "HaHu dispatch failed",
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
