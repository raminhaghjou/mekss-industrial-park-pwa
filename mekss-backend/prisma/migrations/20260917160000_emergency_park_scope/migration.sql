-- Park-scoped emergency alerts so a park incident only fans out to that park.
ALTER TABLE "EmergencyAlert" ADD COLUMN "parkId" TEXT;

CREATE INDEX "EmergencyAlert_parkId_status_createdAt_idx" ON "EmergencyAlert"("parkId", "status", "createdAt");

ALTER TABLE "EmergencyAlert"
  ADD CONSTRAINT "EmergencyAlert_parkId_fkey"
  FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
