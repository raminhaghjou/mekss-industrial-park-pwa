-- AlterEnum
ALTER TYPE "MarketRateKey" ADD VALUE IF NOT EXISTS 'COPPER';
ALTER TYPE "MarketRateKey" ADD VALUE IF NOT EXISTS 'ALUMINUM';
ALTER TYPE "MarketRateKey" ADD VALUE IF NOT EXISTS 'OIL';
ALTER TYPE "MarketRateKey" ADD VALUE IF NOT EXISTS 'BITUMEN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "requestedParkId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketRateHistory" (
    "id" TEXT NOT NULL,
    "key" "MarketRateKey" NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketRateId" TEXT,
    CONSTRAINT "MarketRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_requestedParkId_isApproved_role_idx" ON "User"("requestedParkId", "isApproved", "role");
CREATE INDEX IF NOT EXISTS "MarketRateHistory_key_recordedAt_idx" ON "MarketRateHistory"("key", "recordedAt");
CREATE INDEX IF NOT EXISTS "MarketRateHistory_marketRateId_recordedAt_idx" ON "MarketRateHistory"("marketRateId", "recordedAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_requestedParkId_fkey" FOREIGN KEY ("requestedParkId") REFERENCES "IndustrialPark"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MarketRateHistory" ADD CONSTRAINT "MarketRateHistory_marketRateId_fkey" FOREIGN KEY ("marketRateId") REFERENCES "MarketRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
