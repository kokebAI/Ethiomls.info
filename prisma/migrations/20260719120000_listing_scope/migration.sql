-- CreateEnum
CREATE TYPE "ListingScope" AS ENUM ('SINGLE', 'PROPERTY');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN "listingScope" "ListingScope" NOT NULL DEFAULT 'SINGLE';
