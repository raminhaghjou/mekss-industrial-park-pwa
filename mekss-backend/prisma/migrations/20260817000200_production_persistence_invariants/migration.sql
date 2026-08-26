-- Production persistence invariants. This migration is the sole schema writer for deployment state.

CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'IN_APP');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE');

-- Exactly one non-null sentinel can identify the production bootstrap account; normal users remain NULL.
ALTER TABLE "User"
  ADD COLUMN "bootstrapKey" TEXT,
  ADD COLUMN "bootstrapCreatedAt" TIMESTAMP(3);

ALTER TABLE "OtpChallenge"
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "attemptWindowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- Existing rows are retained as successful legacy records while new producers set an explicit actor/result.
ALTER TABLE "AuditLog"
  ADD COLUMN "actorIdentifier" TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN "result" "AuditResult" NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN "correlationId" TEXT;

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "provider" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "providerErrorCode" TEXT,
  "correlationId" TEXT,
  "terminalAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "notificationId" TEXT NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- The composite foreign key makes the stored park and factory scope internally consistent.
CREATE TABLE "ScopedFile" (
  "id" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteSize" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "parkId" TEXT NOT NULL,
  "factoryId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  CONSTRAINT "ScopedFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_bootstrapKey_key" ON "User"("bootstrapKey");
CREATE INDEX "User_bootstrapCreatedAt_idx" ON "User"("bootstrapCreatedAt");
CREATE UNIQUE INDEX "Factory_id_parkId_key" ON "Factory"("id", "parkId");

-- Refresh-token rotation/revocation and OTP lockout queries remain durable and index-supported across restarts.
CREATE INDEX "RefreshToken_userId_revokedAt_expiresAt_idx" ON "RefreshToken"("userId", "revokedAt", "expiresAt");
CREATE INDEX "OtpChallenge_phoneNumber_purpose_lockedUntil_idx" ON "OtpChallenge"("phoneNumber", "purpose", "lockedUntil");
CREATE INDEX "OtpChallenge_phoneNumber_purpose_consumedAt_createdAt_idx" ON "OtpChallenge"("phoneNumber", "purpose", "consumedAt", "createdAt");

-- Authority and idempotency are already unique in the initial canonical migration; this supports stateful callback scans.
CREATE INDEX "PaymentTransaction_status_createdAt_idx" ON "PaymentTransaction"("status", "createdAt");

CREATE UNIQUE INDEX "NotificationDelivery_jobId_key" ON "NotificationDelivery"("jobId");
CREATE INDEX "NotificationDelivery_notificationId_status_idx" ON "NotificationDelivery"("notificationId", "status");
CREATE INDEX "NotificationDelivery_status_terminalAt_idx" ON "NotificationDelivery"("status", "terminalAt");
CREATE INDEX "NotificationDelivery_correlationId_idx" ON "NotificationDelivery"("correlationId");

CREATE UNIQUE INDEX "ScopedFile_objectKey_key" ON "ScopedFile"("objectKey");
CREATE INDEX "ScopedFile_parkId_factoryId_createdAt_idx" ON "ScopedFile"("parkId", "factoryId", "createdAt");
CREATE INDEX "ScopedFile_factoryId_createdAt_idx" ON "ScopedFile"("factoryId", "createdAt");
CREATE INDEX "ScopedFile_uploadedById_createdAt_idx" ON "ScopedFile"("uploadedById", "createdAt");

CREATE INDEX "AuditLog_actorIdentifier_createdAt_idx" ON "AuditLog"("actorIdentifier", "createdAt");
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

ALTER TABLE "NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScopedFile"
  ADD CONSTRAINT "ScopedFile_parkId_fkey"
  FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ScopedFile_factoryId_parkId_fkey"
  FOREIGN KEY ("factoryId", "parkId") REFERENCES "Factory"("id", "parkId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScopedFile_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Audit entries are immutable after insertion. Application services append records only.
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_prevent_update"
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER "AuditLog_prevent_delete"
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
