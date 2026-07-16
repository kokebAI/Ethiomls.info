import cron from "node-cron";
import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  EXPIRY_REMINDER_LEAD_DAYS,
  PropertyStatus,
  STALE_LISTING_DAYS,
  toListingStatus,
} from "@/src/domain/property-status";
import { smsNotificationEngine } from "@/src/services/sms.service";

function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

/**
 * SMS reminders for listings approaching the 30-day freshness threshold
 * (sent once when last refresh is older than 25 days).
 */
export async function dispatchExpiryReminders(): Promise<number> {
  const day25Cutoff = daysAgo(STALE_LISTING_DAYS - EXPIRY_REMINDER_LEAD_DAYS);
  const day30Cutoff = daysAgo(STALE_LISTING_DAYS);

  const candidates = await prisma.listing.findMany({
    where: {
      status: ListingStatus.PUBLISHED,
      expiryReminderSentAt: null,
      lastRefreshDate: {
        lte: day25Cutoff,
        gt: day30Cutoff,
      },
    },
    include: {
      owner: { select: { phone: true, localePrefs: true } },
    },
    take: 500,
  });

  let sent = 0;
  for (const listing of candidates) {
    const phone = listing.owner.phone;
    if (!phone) continue;

    const result = await smsNotificationEngine.sendTemplate({
      toE164: phone,
      templateId: "listing_expiry_reminder",
      user: listing.owner,
      url: `/listing/${listing.id}/renew`,
    });

    if (result.ok) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { expiryReminderSentAt: new Date() },
      });
      sent += 1;
    }
  }

  return sent;
}

/**
 * Archive listings older than 30 days without refresh and notify owners by SMS.
 */
export async function archiveStaleListings(): Promise<number> {
  const cutoff = daysAgo(STALE_LISTING_DAYS);
  const stale = await prisma.listing.findMany({
    where: {
      status: ListingStatus.PUBLISHED,
      lastRefreshDate: { lt: cutoff },
    },
    include: {
      owner: { select: { phone: true, localePrefs: true } },
    },
    take: 500,
  });

  let archived = 0;
  for (const listing of stale) {
    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: toListingStatus(PropertyStatus.ARCHIVED) },
    });
    archived += 1;

    if (listing.owner.phone) {
      await smsNotificationEngine.sendTemplate({
        toE164: listing.owner.phone,
        templateId: "listing_archived",
        user: listing.owner,
        url: `/listing/${listing.id}/renew`,
      });
    }
  }

  return archived;
}

export async function runStaleListingsJob(): Promise<void> {
  const reminders = await dispatchExpiryReminders();
  const archived = await archiveStaleListings();
  console.info(
    `[stale-listings] reminders=${reminders} archived=${archived} @ ${new Date().toISOString()}`,
  );
}

const shouldDaemonize = process.argv.includes("--schedule");
const isDirectRun = process.argv[1]?.includes("stale-listings");

if (shouldDaemonize) {
  // Daily 02:00 East Africa Time (Africa/Addis_Ababa).
  cron.schedule(
    "0 2 * * *",
    () => {
      void runStaleListingsJob();
    },
    { timezone: "Africa/Addis_Ababa" },
  );
  console.info(
    "[stale-listings] cron scheduled for 02:00 Africa/Addis_Ababa daily",
  );
} else if (isDirectRun) {
  void runStaleListingsJob()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
