-- CreateEnum
CREATE TYPE "PlateType" AS ENUM ('PRIVATE', 'PUBLIC', 'TAXI', 'GOVERNMENT', 'POLICE', 'MILITARY', 'DISABLED', 'AGRICULTURAL', 'FREE_ZONE', 'OTHER');

-- CreateEnum
CREATE TYPE "PlateReadEngine" AS ENUM ('PYTHON', 'NODE', 'DEVICE', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlateReadOutcome" AS ENUM ('MATCHED', 'SUGGESTED', 'NOT_FOUND', 'UNREADABLE', 'CONFIRMED', 'CORRECTED');

-- AlterTable
ALTER TABLE "GatePass" ADD COLUMN "plateType" "PlateType" NOT NULL DEFAULT 'PRIVATE';

-- CreateIndex
CREATE INDEX "GatePass_status_licensePlate_idx" ON "GatePass"("status", "licensePlate");

-- CreateTable
CREATE TABLE "PlateReadEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "rawText" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "plateType" "PlateType",
    "confidence" DOUBLE PRECISION NOT NULL,
    "engine" "PlateReadEngine" NOT NULL,
    "outcome" "PlateReadOutcome" NOT NULL,
    "correctedPlate" TEXT,
    "frames" INTEGER NOT NULL DEFAULT 1,
    "latencyMs" INTEGER,
    "bbox" JSONB,
    "imageKey" TEXT,
    "cropKey" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guardId" TEXT NOT NULL,
    "parkId" TEXT,
    "gatePassId" TEXT,

    CONSTRAINT "PlateReadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlateReadEvent_parkId_createdAt_idx" ON "PlateReadEvent"("parkId", "createdAt");

-- CreateIndex
CREATE INDEX "PlateReadEvent_plate_idx" ON "PlateReadEvent"("plate");

-- CreateIndex
CREATE INDEX "PlateReadEvent_guardId_createdAt_idx" ON "PlateReadEvent"("guardId", "createdAt");

-- CreateIndex
CREATE INDEX "PlateReadEvent_gatePassId_idx" ON "PlateReadEvent"("gatePassId");

-- CreateIndex
CREATE INDEX "PlateReadEvent_createdAt_idx" ON "PlateReadEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PlateReadEvent" ADD CONSTRAINT "PlateReadEvent_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlateReadEvent" ADD CONSTRAINT "PlateReadEvent_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlateReadEvent" ADD CONSTRAINT "PlateReadEvent_gatePassId_fkey" FOREIGN KEY ("gatePassId") REFERENCES "GatePass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
