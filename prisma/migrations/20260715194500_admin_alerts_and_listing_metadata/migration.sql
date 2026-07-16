-- Add listing metadata tags, collision index, and admin dashboard alerts.

ALTER TABLE "listings" ADD COLUMN "metadataTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "listings_subCityId_priceAmount_bedrooms_category_idx"
  ON "listings"("subCityId", "priceAmount", "bedrooms", "category");

CREATE TABLE "admin_alerts" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'WARNING',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "listingId" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "admin_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_alerts_isRead_createdAt_idx" ON "admin_alerts"("isRead", "createdAt");
CREATE INDEX "admin_alerts_type_createdAt_idx" ON "admin_alerts"("type", "createdAt");

ALTER TABLE "admin_alerts"
  ADD CONSTRAINT "admin_alerts_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
