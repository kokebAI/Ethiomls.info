-- EthioMLS initial migration
-- Enables PostGIS and creates the core MLS schema.

CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM (
  'BUYER_RENTER',
  'INDEPENDENT_DELALA',
  'CORPORATE_DEVELOPER',
  'ADMIN'
);

CREATE TYPE "ConstructionStage" AS ENUM (
  'EARTHWORKS_FOUNDATION',
  'SUBSTRUCTURE',
  'SUPERSTRUCTURE',
  'ROOFING_ENVELOPE',
  'MEP_INSTALLATION',
  'INTERIOR_FINISHING',
  'EXTERNAL_WORKS',
  'FULLY_COMPLETED'
);

CREATE TYPE "ListingStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'UNDER_OFFER',
  'SOLD',
  'RENTED',
  'ARCHIVED'
);

CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT', 'OFF_PLAN');

CREATE TYPE "PropertyCategory" AS ENUM (
  'RESIDENTIAL',
  'COMMERCIAL',
  'MIXED_USE',
  'LAND'
);

CREATE TYPE "EscrowStatus" AS ENUM (
  'NOT_REQUIRED',
  'PENDING_SETUP',
  'ACTIVE',
  'FUNDS_LOCKED',
  'PARTIALLY_RELEASED',
  'FULLY_RELEASED',
  'DISPUTED',
  'CLOSED'
);

CREATE TYPE "ForeignClearanceStatus" AS ENUM (
  'NOT_APPLICABLE',
  'PENDING',
  'UNDER_REVIEW',
  'CLEARED',
  'CONDITIONAL',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE "CurrencyCode" AS ENUM ('ETB', 'USD');

-- CreateTable
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'BUYER_RENTER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "localePrefs" TEXT[] DEFAULT ARRAY['am', 'en']::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sub_cities" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" JSONB NOT NULL,
  "description" JSONB,
  "city" TEXT NOT NULL DEFAULT 'Addis Ababa',
  "region" TEXT NOT NULL DEFAULT 'Addis Ababa',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "centroid" geometry(Point, 4326),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sub_cities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "developer_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tradeName" TEXT NOT NULL,
  "displayName" JSONB NOT NULL,
  "registrationNumber" TEXT NOT NULL,
  "tin" TEXT,
  "licenseNumber" TEXT,
  "licenseExpiresAt" TIMESTAMP(3),
  "headquartersSubCityId" TEXT,
  "website" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "developer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delala_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "displayName" JSONB NOT NULL,
  "licenseNumber" TEXT,
  "operatingSubCityId" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "delala_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "developerId" TEXT NOT NULL,
  "subCityId" TEXT,
  "title" JSONB NOT NULL,
  "description" JSONB NOT NULL,
  "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "constructionStage" "ConstructionStage" NOT NULL DEFAULT 'EARTHWORKS_FOUNDATION',
  "completionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "location" geometry(Point, 4326),
  "addressLine" TEXT,
  "panoramicImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "virtualWalkthroughConfig" JSONB,
  "coverImageUrl" TEXT,
  "galleryImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "requiresEscrow" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "listings" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "developerId" TEXT,
  "delalaId" TEXT,
  "projectId" TEXT,
  "subCityId" TEXT,
  "title" JSONB NOT NULL,
  "description" JSONB NOT NULL,
  "listingType" "ListingType" NOT NULL,
  "category" "PropertyCategory" NOT NULL DEFAULT 'RESIDENTIAL',
  "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "priceAmount" DECIMAL(18,2) NOT NULL,
  "priceCurrency" "CurrencyCode" NOT NULL DEFAULT 'ETB',
  "bedrooms" INTEGER,
  "bathrooms" INTEGER,
  "floorAreaSqm" DECIMAL(12,2),
  "plotAreaSqm" DECIMAL(12,2),
  "constructionStage" "ConstructionStage",
  "completionPercent" DECIMAL(5,2),
  "location" geometry(Point, 4326),
  "addressLine" TEXT,
  "panoramicImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "virtualWalkthroughConfig" JSONB,
  "coverImageUrl" TEXT,
  "galleryImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "openToForeignBuyers" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "escrow_accounts" (
  "id" TEXT NOT NULL,
  "projectId" TEXT,
  "listingId" TEXT,
  "buyerId" TEXT,
  "status" "EscrowStatus" NOT NULL DEFAULT 'PENDING_SETUP',
  "escrowBankName" TEXT NOT NULL,
  "escrowAccountNumber" TEXT NOT NULL,
  "authorityApprovalRef" TEXT,
  "authorityApprovedAt" TIMESTAMP(3),
  "currency" "CurrencyCode" NOT NULL DEFAULT 'ETB',
  "totalDeposited" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalReleased" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "fundsLockedUntilStage" "ConstructionStage" NOT NULL DEFAULT 'EARTHWORKS_FOUNDATION',
  "lastVerifiedStage" "ConstructionStage",
  "lastStageVerifiedAt" TIMESTAMP(3),
  "releaseSchedule" JSONB NOT NULL,
  "transferCompletionThreshold" INTEGER NOT NULL DEFAULT 80,
  "buyerConsentEarlyTransfer" BOOLEAN NOT NULL DEFAULT false,
  "contractDocumentUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "escrow_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "foreign_investor_clearances" (
  "id" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "listingId" TEXT,
  "status" "ForeignClearanceStatus" NOT NULL DEFAULT 'PENDING',
  "nationalityCountryCode" TEXT NOT NULL,
  "passportOrIdNumber" TEXT NOT NULL,
  "isLicensedForeignInvestor" BOOLEAN NOT NULL DEFAULT false,
  "investmentLicenseNumber" TEXT,
  "minimumInvestmentUsd" DECIMAL(18,2) NOT NULL DEFAULT 150000,
  "declaredInvestmentUsd" DECIMAL(18,2),
  "minimumInvestmentMet" BOOLEAN NOT NULL DEFAULT false,
  "foreignCurrencyProofUrl" TEXT,
  "foreignCurrencyRemittanceRef" TEXT,
  "usedLocalBankFinancing" BOOLEAN NOT NULL DEFAULT false,
  "oneHouseLimitAcknowledged" BOOLEAN NOT NULL DEFAULT false,
  "existingLocalHouseCount" INTEGER NOT NULL DEFAULT 0,
  "nationalSecurityCleared" BOOLEAN NOT NULL DEFAULT false,
  "criminalRecordCleared" BOOLEAN NOT NULL DEFAULT false,
  "reciprocityOk" BOOLEAN NOT NULL DEFAULT true,
  "ministryApprovalRef" TEXT,
  "ministryApprovedAt" TIMESTAMP(3),
  "clearanceExpiresAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "foreign_investor_clearances_pkey" PRIMARY KEY ("id")
);

-- Indexes & uniques
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE INDEX "users_role_idx" ON "users"("role");

CREATE UNIQUE INDEX "sub_cities_code_key" ON "sub_cities"("code");
CREATE INDEX "sub_cities_city_sortOrder_idx" ON "sub_cities"("city", "sortOrder");

CREATE UNIQUE INDEX "developer_profiles_userId_key" ON "developer_profiles"("userId");
CREATE UNIQUE INDEX "developer_profiles_registrationNumber_key" ON "developer_profiles"("registrationNumber");
CREATE INDEX "developer_profiles_isVerified_idx" ON "developer_profiles"("isVerified");

CREATE UNIQUE INDEX "delala_profiles_userId_key" ON "delala_profiles"("userId");

CREATE INDEX "projects_developerId_idx" ON "projects"("developerId");
CREATE INDEX "projects_constructionStage_idx" ON "projects"("constructionStage");

CREATE INDEX "listings_status_listingType_idx" ON "listings"("status", "listingType");
CREATE INDEX "listings_subCityId_idx" ON "listings"("subCityId");
CREATE INDEX "listings_ownerId_idx" ON "listings"("ownerId");

CREATE UNIQUE INDEX "escrow_accounts_projectId_key" ON "escrow_accounts"("projectId");
CREATE UNIQUE INDEX "escrow_accounts_listingId_key" ON "escrow_accounts"("listingId");
CREATE INDEX "escrow_accounts_status_idx" ON "escrow_accounts"("status");
CREATE INDEX "escrow_accounts_buyerId_idx" ON "escrow_accounts"("buyerId");

CREATE INDEX "foreign_investor_clearances_status_idx" ON "foreign_investor_clearances"("status");
CREATE INDEX "foreign_investor_clearances_applicantId_idx" ON "foreign_investor_clearances"("applicantId");
CREATE INDEX "foreign_investor_clearances_nationalityCountryCode_idx" ON "foreign_investor_clearances"("nationalityCountryCode");

-- Spatial indexes
CREATE INDEX "sub_cities_centroid_gix" ON "sub_cities" USING GIST ("centroid");
CREATE INDEX "projects_location_gix" ON "projects" USING GIST ("location");
CREATE INDEX "listings_location_gix" ON "listings" USING GIST ("location");

-- Foreign keys
ALTER TABLE "developer_profiles"
  ADD CONSTRAINT "developer_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "developer_profiles"
  ADD CONSTRAINT "developer_profiles_headquartersSubCityId_fkey"
  FOREIGN KEY ("headquartersSubCityId") REFERENCES "sub_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delala_profiles"
  ADD CONSTRAINT "delala_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delala_profiles"
  ADD CONSTRAINT "delala_profiles_operatingSubCityId_fkey"
  FOREIGN KEY ("operatingSubCityId") REFERENCES "sub_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_developerId_fkey"
  FOREIGN KEY ("developerId") REFERENCES "developer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_subCityId_fkey"
  FOREIGN KEY ("subCityId") REFERENCES "sub_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "listings"
  ADD CONSTRAINT "listings_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listings"
  ADD CONSTRAINT "listings_developerId_fkey"
  FOREIGN KEY ("developerId") REFERENCES "developer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "listings"
  ADD CONSTRAINT "listings_delalaId_fkey"
  FOREIGN KEY ("delalaId") REFERENCES "delala_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "listings"
  ADD CONSTRAINT "listings_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "listings"
  ADD CONSTRAINT "listings_subCityId_fkey"
  FOREIGN KEY ("subCityId") REFERENCES "sub_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "escrow_accounts"
  ADD CONSTRAINT "escrow_accounts_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "escrow_accounts"
  ADD CONSTRAINT "escrow_accounts_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "escrow_accounts"
  ADD CONSTRAINT "escrow_accounts_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "foreign_investor_clearances"
  ADD CONSTRAINT "foreign_investor_clearances_applicantId_fkey"
  FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "foreign_investor_clearances"
  ADD CONSTRAINT "foreign_investor_clearances_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
