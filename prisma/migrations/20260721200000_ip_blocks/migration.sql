-- Temporary IP bans for OTP / SMS abuse.
CREATE TABLE IF NOT EXISTS "ip_blocks" (
  "ip" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "blockedUntil" TIMESTAMP(3) NOT NULL,
  "strikeCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ip_blocks_pkey" PRIMARY KEY ("ip")
);

CREATE INDEX IF NOT EXISTS "ip_blocks_blockedUntil_idx"
  ON "ip_blocks"("blockedUntil");
