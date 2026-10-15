import { ListingStatus } from "@prisma/client";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export type RenewListingResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "not_found" | "forbidden" | "not_live" };

/** Restart the 30-day freshness clock for a published listing. */
export async function renewPublishedListing(
  listingId: string,
): Promise<RenewListingResult> {
  const session = await getSession();
  if (!session) return { ok: false, code: "unauthorized" };

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      status: true,
      ownerId: true,
      developer: { select: { userId: true } },
    },
  });
  if (!listing) return { ok: false, code: "not_found" };

  const staff = await getCurrentOpsStaff();
  const isOwner = session.userId === listing.ownerId;
  const isDeveloper = session.userId === listing.developer?.userId;
  if (!staff && !isOwner && !isDeveloper) {
    return { ok: false, code: "forbidden" };
  }
  if (listing.status !== ListingStatus.PUBLISHED) {
    return { ok: false, code: "not_live" };
  }

  await prisma.listing.update({
    where: { id: listing.id },
    data: {
      lastRefreshDate: new Date(),
      expiryReminderSentAt: null,
    },
  });
  return { ok: true };
}
