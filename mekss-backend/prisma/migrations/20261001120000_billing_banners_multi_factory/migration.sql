-- CreateEnum
CREATE TYPE "InvoiceCategory" AS ENUM ('CHARGE', 'PLATFORM');

-- CreateEnum
CREATE TYPE "InvoiceItemType" AS ENUM ('WATER', 'SEWAGE', 'RENOVATION_SHARE', 'SHARE_DEBT', 'CHARGE_OTHER', 'ENTRANCE_FEE', 'MONTHLY_MEMBERSHIP', 'PLATFORM_OTHER', 'CARRIED_PENALTY');

-- CreateEnum
CREATE TYPE "InvoiceAdjustmentType" AS ENUM ('EDIT', 'DISCOUNT', 'EXTENSION', 'SETTLEMENT', 'INSTALLMENT');

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'INSTALLMENTS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VehicleType" ADD VALUE 'KHAVAR';
ALTER TYPE "VehicleType" ADD VALUE 'TAK';
ALTER TYPE "VehicleType" ADD VALUE 'TEN_WHEELER';
ALTER TYPE "VehicleType" ADD VALUE 'TRAILER';

-- AlterTable
ALTER TABLE "Factory" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "category" "InvoiceCategory" NOT NULL DEFAULT 'CHARGE',
ADD COLUMN     "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "installmentNo" INTEGER,
ADD COLUMN     "parentInvoiceId" TEXT,
ADD COLUMN     "penaltyStartsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EmergencyAlert" ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedById" TEXT;

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "type" "InvoiceItemType" NOT NULL,
    "title" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceAdjustment" (
    "id" TEXT NOT NULL,
    "type" "InvoiceAdjustmentType" NOT NULL,
    "amount" DECIMAL(15,2),
    "fromDueDate" TIMESTAMP(3),
    "toDueDate" TIMESTAMP(3),
    "note" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,

    CONSTRAINT "InvoiceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "category" "InvoiceCategory" NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "InvoiceImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "desktopImageId" TEXT NOT NULL,
    "mobileImageId" TEXT NOT NULL,
    "linkUrl" TEXT,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parkId" TEXT,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "DashboardBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_sortOrder_idx" ON "InvoiceItem"("invoiceId", "sortOrder");

-- CreateIndex
CREATE INDEX "InvoiceAdjustment_invoiceId_createdAt_idx" ON "InvoiceAdjustment"("invoiceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceImportBatch_createdById_fileHash_key" ON "InvoiceImportBatch"("createdById", "fileHash");

-- CreateIndex
CREATE INDEX "DashboardBanner_isActive_sortOrder_idx" ON "DashboardBanner"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "DashboardBanner_parkId_idx" ON "DashboardBanner"("parkId");

-- CreateIndex
CREATE INDEX "Invoice_parentInvoiceId_idx" ON "Invoice"("parentInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_importBatchId_idx" ON "Invoice"("importBatchId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_parentInvoiceId_fkey" FOREIGN KEY ("parentInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "InvoiceImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceImportBatch" ADD CONSTRAINT "InvoiceImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardBanner" ADD CONSTRAINT "DashboardBanner_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardBanner" ADD CONSTRAINT "DashboardBanner_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

