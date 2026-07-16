-- Listing freshness + amenity flags for SMS / broadcast engine.

ALTER TABLE "listings" ADD COLUMN "waterAvailable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN "powerBackup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN "lastRefreshDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "listings" ADD COLUMN "expiryReminderSentAt" TIMESTAMP(3);
ALTER TABLE "listings" ADD COLUMN "telegramBroadcastAt" TIMESTAMP(3);

CREATE INDEX "listings_status_lastRefreshDate_idx" ON "listings"("status", "lastRefreshDate");
