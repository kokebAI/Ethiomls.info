-- AlterTable
ALTER TABLE "listings" ADD COLUMN "sourcePostedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "listings_sourcePostedAt_idx" ON "listings"("sourcePostedAt");
