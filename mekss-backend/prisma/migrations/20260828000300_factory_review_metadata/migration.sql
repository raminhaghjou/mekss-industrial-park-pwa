-- Add nullable factory review metadata without rewriting existing statuses, approval flags, identities, or relations.
ALTER TABLE "Factory"
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "Factory_parkId_status_isApproved_idx" ON "Factory"("parkId", "status", "isApproved");
CREATE INDEX "Factory_reviewedById_reviewedAt_idx" ON "Factory"("reviewedById", "reviewedAt");

ALTER TABLE "Factory"
  ADD CONSTRAINT "Factory_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
