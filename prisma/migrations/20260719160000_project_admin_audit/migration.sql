-- Pull live projects into the admin audit queue before they can be public again.
UPDATE "projects"
SET status = 'PENDING_REVIEW'
WHERE status = 'PUBLISHED';

-- AlterTable
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "adminAuditApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "adminAuditedById" TEXT,
  ADD COLUMN IF NOT EXISTS "adminAuditNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "adminAuditChecklist" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects"("status");
CREATE INDEX IF NOT EXISTS "projects_adminAuditApprovedAt_idx" ON "projects"("adminAuditApprovedAt");
CREATE INDEX IF NOT EXISTS "projects_adminAuditedById_idx" ON "projects"("adminAuditedById");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_adminAuditedById_fkey'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_adminAuditedById_fkey"
      FOREIGN KEY ("adminAuditedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
