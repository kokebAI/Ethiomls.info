-- Fayda identity, consent-gated leads, Telebirr / CBE Birr subscriptions.

CREATE TYPE "BillingProvider" AS ENUM ('TELEBIRR', 'CBE_BIRR');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'EXEMPT', 'CANCELLED');
CREATE TYPE "LeadStatus" AS ENUM ('CAPTURED', 'ROUTED', 'CONTACTED', 'CLOSED');

CREATE TABLE "fayda_identities" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "subject" TEXT NOT NULL,
  "verifiedName" TEXT NOT NULL,
  "profilePhotoUrl" TEXT,
  "phoneE164" TEXT NOT NULL,
  "idTokenHash" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "rawClaims" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fayda_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fayda_identities_userId_key" ON "fayda_identities"("userId");
CREATE UNIQUE INDEX "fayda_identities_subject_key" ON "fayda_identities"("subject");
CREATE INDEX "fayda_identities_phoneE164_idx" ON "fayda_identities"("phoneE164");

ALTER TABLE "fayda_identities"
  ADD CONSTRAINT "fayda_identities_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "leads" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "requesterId" TEXT,
  "brokerUserId" TEXT,
  "delalaId" TEXT,
  "status" "LeadStatus" NOT NULL DEFAULT 'CAPTURED',
  "consentGranted" BOOLEAN NOT NULL DEFAULT false,
  "consentGrantedAt" TIMESTAMP(3),
  "maskedPhone" TEXT NOT NULL,
  "revealedPhone" TEXT,
  "message" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leads_listingId_createdAt_idx" ON "leads"("listingId", "createdAt");
CREATE INDEX "leads_requesterId_idx" ON "leads"("requesterId");
CREATE INDEX "leads_consentGranted_idx" ON "leads"("consentGranted");

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_brokerUserId_fkey"
  FOREIGN KEY ("brokerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_delalaId_fkey"
  FOREIGN KEY ("delalaId") REFERENCES "delala_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planCode" TEXT NOT NULL DEFAULT 'delala-standard',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "amountEtb" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "pilotExempt" BOOLEAN NOT NULL DEFAULT false,
  "billingProvider" "BillingProvider",
  "lastExternalTxnId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "subscriptions_pilotExempt_idx" ON "subscriptions"("pilotExempt");

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "billing_webhook_events" (
  "id" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "externalTxnId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "signatureOk" BOOLEAN NOT NULL DEFAULT false,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "amountEtb" DECIMAL(18,2),
  "userId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_webhook_events_provider_externalTxnId_key"
  ON "billing_webhook_events"("provider", "externalTxnId");
CREATE INDEX "billing_webhook_events_processed_createdAt_idx"
  ON "billing_webhook_events"("processed", "createdAt");

ALTER TABLE "billing_webhook_events"
  ADD CONSTRAINT "billing_webhook_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
