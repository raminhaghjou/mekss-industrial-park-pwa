-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN "parkId" TEXT;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PaymentTransaction_parkId_status_idx" ON "PaymentTransaction"("parkId", "status");
