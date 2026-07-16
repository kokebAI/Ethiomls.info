import { Queue } from "bullmq";
import IORedis from "ioredis";

export const BROADCAST_QUEUE_NAME = "ethiomls-listing-broadcast";

export type ListingBroadcastJob = {
  listingId: string;
  reason: "status_active" | "manual";
};

let connection: IORedis | null = null;
let queue: Queue<ListingBroadcastJob> | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export function getBroadcastQueue(): Queue<ListingBroadcastJob> {
  if (!queue) {
    queue = new Queue<ListingBroadcastJob>(BROADCAST_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });
  }
  return queue;
}

/**
 * Enqueue Telegram channel broadcast when a listing becomes ACTIVE.
 */
export async function enqueueListingBroadcast(
  listingId: string,
  reason: ListingBroadcastJob["reason"] = "status_active",
): Promise<string> {
  const job = await getBroadcastQueue().add(
    "publish-listing-card",
    { listingId, reason },
    {
      // Unique per enqueue so re-activation rebroadcasts cleanly.
      jobId: `broadcast-${listingId}-${reason}-${Date.now()}`,
    },
  );
  return job.id ?? listingId;
}
