-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM (
  'NOT_APPLICABLE',
  'PENDING_REVIEW',
  'SENT',
  'FAILED',
  'DISCARDED'
);

-- AlterTable
ALTER TABLE "listings"
  ADD COLUMN "scrapedRawText" TEXT,
  ADD COLUMN "notificationStatus" "NotificationStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN "notificationSentAt" TIMESTAMP(3),
  ADD COLUMN "notificationError" TEXT;

-- CreateIndex
CREATE INDEX "listings_notificationStatus_idx" ON "listings"("notificationStatus");
