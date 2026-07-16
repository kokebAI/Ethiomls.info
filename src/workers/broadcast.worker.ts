import { Worker } from "bullmq";
import { asStringArray } from "@/lib/db/jsonArrays";
import { prisma } from "@/lib/db/prisma";
import { isActiveListingStatus } from "@/src/domain/property-status";
import {
  BROADCAST_QUEUE_NAME,
  getRedisConnection,
  type ListingBroadcastJob,
} from "@/src/services/broadcast.queue";
import { buildWatermarkedListingWebp } from "@/src/services/listing-image.service";
import {
  loadBroadcastListing,
  readTitleLocales,
} from "@/src/services/listing-lifecycle.service";
import { telegramBotService } from "@/src/services/telegram.service";

async function processBroadcastJob(job: ListingBroadcastJob) {
  const listing = await loadBroadcastListing(job.listingId);
  if (!listing) {
    throw new Error(`Listing not found: ${job.listingId}`);
  }

  if (!isActiveListingStatus(listing.status)) {
    console.info(
      `[broadcast] skip ${listing.id} — status=${listing.status} (not ACTIVE)`,
    );
    return { skipped: true as const };
  }

  const gallery = asStringArray(listing.galleryImageUrls);
  const panoramas = asStringArray(listing.panoramicImageUrls);
  const imageSource =
    listing.coverImageUrl ?? gallery[0] ?? panoramas[0] ?? null;

  const watermarked = await buildWatermarkedListingWebp(
    imageSource,
    listing.id,
  );
  const titles = readTitleLocales(listing.title);
  const subCityName =
    listing.subCity?.code ??
    (typeof listing.subCity?.name === "object" &&
    listing.subCity?.name &&
    !Array.isArray(listing.subCity.name)
      ? String(
          (listing.subCity.name as Record<string, unknown>).en ??
            listing.subCity.code,
        )
      : "Addis Ababa");

  const card = telegramBotService.buildListingCard({
    listingId: listing.id,
    propertyType: listing.category,
    subCity: subCityName,
    priceAmount: Number(listing.priceAmount),
    priceCurrency: listing.priceCurrency,
    waterAvailable: listing.waterAvailable,
    powerBackup: listing.powerBackup,
    titleEn: titles.en,
    titleAm: titles.am,
    photo: watermarked?.buffer,
    filename: watermarked?.filename,
  });

  const published = await telegramBotService.publishCard(card);
  if (!published.ok) {
    throw new Error(published.error ?? "Telegram publish failed");
  }

  await prisma.listing.update({
    where: { id: listing.id },
    data: { telegramBroadcastAt: new Date() },
  });

  return {
    skipped: false as const,
    messageId: published.messageId,
    mock: published.mock ?? false,
  };
}

const worker = new Worker<ListingBroadcastJob>(
  BROADCAST_QUEUE_NAME,
  async (job) => processBroadcastJob(job.data),
  {
    connection: getRedisConnection(),
    concurrency: 2,
  },
);

worker.on("completed", (job, result) => {
  console.info(`[broadcast.worker] completed ${job.id}`, result);
});

worker.on("failed", (job, error) => {
  console.error(`[broadcast.worker] failed ${job?.id}`, error);
});

console.info(
  `[broadcast.worker] listening on queue "${BROADCAST_QUEUE_NAME}"`,
);

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
