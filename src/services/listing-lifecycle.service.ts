import { ListingStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PropertyStatus, toListingStatus } from "@/src/domain/property-status";
import { enqueueListingBroadcast } from "@/src/services/broadcast.queue";
import { smsNotificationEngine } from "@/src/services/sms.service";

function localizedTitle(
  title: Prisma.JsonValue,
  locale: "en" | "am",
): string | undefined {
  if (!title || typeof title !== "object" || Array.isArray(title)) return undefined;
  const value = (title as Record<string, unknown>)[locale];
  return typeof value === "string" ? value : undefined;
}

/**
 * Transition a listing to PropertyStatus.ACTIVE and enqueue Telegram broadcast.
 */
export async function activateListing(listingId: string): Promise<{
  listingId: string;
  status: ListingStatus;
  broadcastJobId: string;
}> {
  const listing = await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: toListingStatus(PropertyStatus.ACTIVE),
      publishedAt: new Date(),
      lastRefreshDate: new Date(),
      expiryReminderSentAt: null,
    },
  });

  const broadcastJobId = await enqueueListingBroadcast(
    listing.id,
    "status_active",
  );

  return {
    listingId: listing.id,
    status: listing.status,
    broadcastJobId,
  };
}

export async function loadBroadcastListing(listingId: string) {
  return prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      subCity: { select: { code: true, name: true } },
      owner: { select: { id: true, phone: true, localePrefs: true, fullName: true } },
      delala: {
        select: {
          id: true,
          user: { select: { id: true, phone: true, localePrefs: true } },
        },
      },
    },
  });
}

export function readTitleLocales(title: Prisma.JsonValue): {
  en?: string;
  am?: string;
} {
  return {
    en: localizedTitle(title, "en"),
    am: localizedTitle(title, "am"),
  };
}

/**
 * Confirm on-site Mesob check or escrow verification via SMS to the owner.
 */
export async function notifyListingVerification(
  listingId: string,
  kind: "mesob" | "escrow",
) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      owner: { select: { phone: true, localePrefs: true } },
    },
  });

  if (!listing?.owner.phone) {
    return { ok: false as const, error: "Owner phone unavailable" };
  }

  return smsNotificationEngine.sendTemplate({
    toE164: listing.owner.phone,
    templateId: "verification_update",
    user: listing.owner,
    kind,
    url: `/listing/${listing.id}`,
  });
}
