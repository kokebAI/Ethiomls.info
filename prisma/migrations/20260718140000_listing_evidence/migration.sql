-- Developer full-pack evidence staging + listing attachments

CREATE TYPE "ListingEvidenceKind" AS ENUM (
  'ORG_REGISTRATION',
  'ORG_LICENSE',
  'ORG_TIN',
  'PROJECT_BROCHURE',
  'FLOOR_PLAN',
  'TITLE_OR_LEASE',
  'CONSTRUCTION_PERMIT',
  'ESCROW_PROOF',
  'UNIT_GALLERY'
);

CREATE TABLE "evidence_uploads" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "ListingEvidenceKind" NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "storagePath" TEXT,
  "publicUrl" TEXT NOT NULL,
  "contentBytes" BYTEA,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_uploads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evidence_uploads_userId_kind_idx" ON "evidence_uploads"("userId", "kind");
CREATE INDEX "evidence_uploads_createdAt_idx" ON "evidence_uploads"("createdAt");

CREATE TABLE "listing_evidence" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "kind" "ListingEvidenceKind" NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "storagePath" TEXT,
  "publicUrl" TEXT NOT NULL,
  "contentBytes" BYTEA,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "listing_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "listing_evidence_listingId_kind_idx" ON "listing_evidence"("listingId", "kind");

ALTER TABLE "listing_evidence"
  ADD CONSTRAINT "listing_evidence_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "listings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
