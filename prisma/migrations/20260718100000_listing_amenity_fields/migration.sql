-- Amenity booleans on listings (beyond waterAvailable / powerBackup).
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "gatedCompound" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "parking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "elevator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "furnished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "escrowVerified" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from legacy metadataTags / amenity:* tags.
UPDATE "listings"
SET
  "parking" = true
WHERE
  "parking" = false
  AND (
    'parking' = ANY ("metadataTags")
    OR 'amenity:parking' = ANY ("metadataTags")
  );

UPDATE "listings"
SET
  "elevator" = true
WHERE
  "elevator" = false
  AND (
    'elevator' = ANY ("metadataTags")
    OR 'amenity:elevator' = ANY ("metadataTags")
  );

UPDATE "listings"
SET
  "furnished" = true
WHERE
  "furnished" = false
  AND (
    'furnished' = ANY ("metadataTags")
    OR 'amenity:furnished' = ANY ("metadataTags")
  );

UPDATE "listings"
SET
  "gatedCompound" = true
WHERE
  "gatedCompound" = false
  AND (
    'gated' = ANY ("metadataTags")
    OR 'gated-compound' = ANY ("metadataTags")
    OR 'security' = ANY ("metadataTags")
    OR 'amenity:gated' = ANY ("metadataTags")
    OR 'amenity:gated-compound' = ANY ("metadataTags")
  );

UPDATE "listings"
SET
  "escrowVerified" = true
WHERE
  "escrowVerified" = false
  AND (
    'escrow' = ANY ("metadataTags")
    OR 'amenity:escrow' = ANY ("metadataTags")
  );

UPDATE "listings"
SET
  "waterAvailable" = true
WHERE
  "waterAvailable" = false
  AND (
    'water' = ANY ("metadataTags")
    OR 'amenity:water' = ANY ("metadataTags")
  );

UPDATE "listings"
SET
  "powerBackup" = true
WHERE
  "powerBackup" = false
  AND (
    'power-backup' = ANY ("metadataTags")
    OR 'amenity:power-backup' = ANY ("metadataTags")
  );
