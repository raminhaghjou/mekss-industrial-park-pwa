CREATE TYPE "EmergencySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "EmergencyStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TABLE "EmergencyAlert" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "EmergencySeverity" NOT NULL,
  "status" "EmergencyStatus" NOT NULL DEFAULT 'OPEN',
  "location" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  CONSTRAINT "EmergencyAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmergencyAlert_status_severity_createdAt_idx" ON "EmergencyAlert"("status", "severity", "createdAt");
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
