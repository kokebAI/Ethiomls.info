-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- AlterTable
ALTER TABLE "listings"
  ADD COLUMN IF NOT EXISTS "inventoryStatus" "InventoryStatus" NOT NULL DEFAULT 'AVAILABLE';

-- Backfill from metadata tags / walkthrough JSON / publication status
UPDATE "listings"
SET "inventoryStatus" = 'SOLD'
WHERE "inventoryStatus" = 'AVAILABLE'
  AND (
    "status" = 'SOLD'
    OR EXISTS (
      SELECT 1 FROM unnest("metadataTags") AS tag
      WHERE lower(tag) = 'status:sold'
    )
    OR lower(COALESCE("virtualWalkthroughConfig"->>'inventoryStatus', '')) = 'sold'
  );

UPDATE "listings"
SET "inventoryStatus" = 'RESERVED'
WHERE "inventoryStatus" = 'AVAILABLE'
  AND (
    "status" IN ('UNDER_OFFER', 'RENTED')
    OR EXISTS (
      SELECT 1 FROM unnest("metadataTags") AS tag
      WHERE lower(tag) = 'status:reserved'
    )
    OR lower(COALESCE("virtualWalkthroughConfig"->>'inventoryStatus', '')) = 'reserved'
  );

UPDATE "listings"
SET "inventoryStatus" = 'AVAILABLE'
WHERE "inventoryStatus" = 'AVAILABLE'
  AND (
    EXISTS (
      SELECT 1 FROM unnest("metadataTags") AS tag
      WHERE lower(tag) = 'status:available'
    )
    OR lower(COALESCE("virtualWalkthroughConfig"->>'inventoryStatus', '')) = 'available'
  );

-- CreateIndex
CREATE INDEX IF NOT EXISTS "listings_projectId_inventoryStatus_idx"
  ON "listings"("projectId", "inventoryStatus");
