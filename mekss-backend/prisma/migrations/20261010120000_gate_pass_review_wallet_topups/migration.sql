-- AlterTable
ALTER TABLE "GatePass" ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WalletTopUp" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "method" TEXT NOT NULL DEFAULT 'ONLINE',
    "provider" TEXT NOT NULL DEFAULT 'MOCK',
    "authority" TEXT NOT NULL,
    "referenceId" TEXT,
    "providerStatus" JSONB,
    "failureReason" TEXT,
    "note" TEXT,
    "balanceAfter" DECIMAL(15,2),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "factoryId" TEXT NOT NULL,
    "initiatedById" TEXT,

    CONSTRAINT "WalletTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletTopUp_authority_key" ON "WalletTopUp"("authority");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTopUp_referenceId_key" ON "WalletTopUp"("referenceId");

-- CreateIndex
CREATE INDEX "WalletTopUp_factoryId_createdAt_idx" ON "WalletTopUp"("factoryId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTopUp_status_createdAt_idx" ON "WalletTopUp"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
