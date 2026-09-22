-- CreateEnum
CREATE TYPE "InvoiceTarget" AS ENUM ('FACTORY', 'PARK');

-- AlterTable: allow park-billed invoices (factoryId nullable) and add park scope
ALTER TABLE "Invoice" ADD COLUMN "targetType" "InvoiceTarget" NOT NULL DEFAULT 'FACTORY';
ALTER TABLE "Invoice" ADD COLUMN "parkId" TEXT;
ALTER TABLE "Invoice" ALTER COLUMN "factoryId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Invoice_parkId_status_idx" ON "Invoice"("parkId", "status");
CREATE INDEX "Invoice_targetType_status_idx" ON "Invoice"("targetType", "status");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
