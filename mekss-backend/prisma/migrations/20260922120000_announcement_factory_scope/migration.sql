-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "factoryId" TEXT;

-- CreateIndex
CREATE INDEX "Announcement_factoryId_createdAt_idx" ON "Announcement"("factoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
