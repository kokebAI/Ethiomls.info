-- Regulatory fields for Proc. 1357 escrow enforcement and Proc. 1388 foreigner eligibility.

ALTER TABLE "listings" ADD COLUMN "isUnfinished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN "constructionPermitId" TEXT;
ALTER TABLE "listings" ADD COLUMN "constructionPermitVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN "foreignerEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN "priceUsdEquivalent" DECIMAL(18,2);
ALTER TABLE "listings" ADD COLUMN "nbeUsdEtbRateUsed" DECIMAL(12,4);

CREATE INDEX "listings_foreignerEligible_idx" ON "listings"("foreignerEligible");
CREATE INDEX "listings_isUnfinished_idx" ON "listings"("isUnfinished");
