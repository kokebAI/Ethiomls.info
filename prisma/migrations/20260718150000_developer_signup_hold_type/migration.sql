-- CreateEnum
CREATE TYPE "LandHoldType" AS ENUM ('FREEHOLD', 'LEASEHOLD');

-- AlterEnum
ALTER TYPE "ListingEvidenceKind" ADD VALUE 'LEASE_AGREEMENT';

-- AlterTable listings
ALTER TABLE "listings" ADD COLUMN "landHoldType" "LandHoldType";

-- AlterTable otp_codes — developer business registration at signup
ALTER TABLE "otp_codes" ADD COLUMN "tradeName" TEXT;
ALTER TABLE "otp_codes" ADD COLUMN "registrationNumber" TEXT;
ALTER TABLE "otp_codes" ADD COLUMN "tin" TEXT;
ALTER TABLE "otp_codes" ADD COLUMN "licenseNumber" TEXT;
