-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parkId" TEXT,
    "factoryId" TEXT,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");

-- CreateIndex
CREATE INDEX "MediaAsset_uploadedById_domain_createdAt_idx" ON "MediaAsset"("uploadedById", "domain", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_domain_createdAt_idx" ON "MediaAsset"("domain", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_parkId_factoryId_createdAt_idx" ON "MediaAsset"("parkId", "factoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
