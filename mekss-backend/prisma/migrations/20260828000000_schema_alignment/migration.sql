-- Align the durable database with the current application schema.
-- Existing advertisement categories are preserved by key before the legacy enum is removed.

CREATE TYPE "ServiceOrderKind" AS ENUM ('FOOD', 'CLEANING', 'FREIGHT', 'OTHER');
CREATE TYPE "MarketRateKey" AS ENUM ('USD', 'EUR', 'CNY', 'IRON', 'GOLD', 'SILVER', 'PLATINUM', 'COIN');
ALTER TYPE "RequestType" ADD VALUE 'SERVICE_ORDER';

CREATE TABLE "AdvertisementCategoryDef" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdvertisementCategoryDef_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AdvertisementCategoryDef" ("id", "key", "label") VALUES
  ('adcat_equipment', 'EQUIPMENT', 'تجهیزات'),
  ('adcat_services', 'SERVICES', 'خدمات'),
  ('adcat_raw_materials', 'RAW_MATERIALS', 'مواد اولیه'),
  ('adcat_job_listings', 'JOB_LISTINGS', 'فرصت شغلی'),
  ('adcat_real_estate', 'REAL_ESTATE', 'املاک'),
  ('adcat_other', 'OTHER', 'سایر');

CREATE UNIQUE INDEX "AdvertisementCategoryDef_key_key" ON "AdvertisementCategoryDef"("key");
CREATE INDEX "AdvertisementCategoryDef_isActive_idx" ON "AdvertisementCategoryDef"("isActive");

ALTER TABLE "Advertisement"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "featuredUntil" TIMESTAMP(3),
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Advertisement" AS advertisement
SET "categoryId" = category_def."id"
FROM "AdvertisementCategoryDef" AS category_def
WHERE category_def."key" = advertisement."category"::TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Advertisement" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'Refusing schema alignment: an advertisement category could not be preserved';
  END IF;
END $$;

ALTER TABLE "Advertisement" ALTER COLUMN "categoryId" SET NOT NULL;
DROP INDEX "Advertisement_category_status_idx";
CREATE INDEX "Advertisement_categoryId_status_idx" ON "Advertisement"("categoryId", "status");
CREATE INDEX "Advertisement_isFeatured_featuredUntil_idx" ON "Advertisement"("isFeatured", "featuredUntil");
ALTER TABLE "Advertisement"
  ADD CONSTRAINT "Advertisement_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "AdvertisementCategoryDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Advertisement" DROP COLUMN "category";
DROP TYPE "AdvertisementCategory";

ALTER TABLE "Factory"
  ADD COLUMN "ceoName" TEXT,
  ADD COLUMN "fax" TEXT,
  ADD COLUMN "landline" TEXT,
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "logo" TEXT,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "pendingChanges" JSONB,
  ADD COLUMN "phoneNumber2" TEXT,
  ADD COLUMN "shopUrl" TEXT,
  ADD COLUMN "socialMedia" JSONB;

ALTER TABLE "Message"
  ADD COLUMN "attachments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Request"
  ADD COLUMN "appointmentSlot" TIMESTAMP(3),
  ADD COLUMN "isToParkManager" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Request_isToParkManager_status_idx" ON "Request"("isToParkManager", "status");

ALTER TABLE "User"
  ADD COLUMN "canApproveRequestTypes" "RequestType"[] NOT NULL DEFAULT ARRAY[]::"RequestType"[],
  ADD COLUMN "defaultDriver" JSONB,
  ADD COLUMN "employeeOfFactoryId" TEXT,
  ADD COLUMN "messagingRestricted" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "User_employeeOfFactoryId_idx" ON "User"("employeeOfFactoryId");
ALTER TABLE "User"
  ADD CONSTRAINT "User_employeeOfFactoryId_fkey"
  FOREIGN KEY ("employeeOfFactoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AdvertisementFavorite" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "advertisementId" TEXT NOT NULL,
  CONSTRAINT "AdvertisementFavorite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdvertisementFavorite_userId_idx" ON "AdvertisementFavorite"("userId");
CREATE UNIQUE INDEX "AdvertisementFavorite_userId_advertisementId_key" ON "AdvertisementFavorite"("userId", "advertisementId");
ALTER TABLE "AdvertisementFavorite"
  ADD CONSTRAINT "AdvertisementFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AdvertisementFavorite_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MarketRate" (
  "id" TEXT NOT NULL,
  "key" "MarketRateKey" NOT NULL,
  "label" TEXT NOT NULL,
  "value" DECIMAL(18,4) NOT NULL,
  "unit" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedById" TEXT,
  CONSTRAINT "MarketRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketRate_key_key" ON "MarketRate"("key");
ALTER TABLE "MarketRate"
  ADD CONSTRAINT "MarketRate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Feedback" (
  "id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "recipientParkId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "senderId" TEXT NOT NULL,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Feedback_recipientParkId_createdAt_idx" ON "Feedback"("recipientParkId", "createdAt");
ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SecurityGuard_userId_shiftStart_idx" ON "SecurityGuard"("userId", "shiftStart");
