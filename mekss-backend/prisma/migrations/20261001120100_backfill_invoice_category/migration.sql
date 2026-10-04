-- Backfill: invoices issued before categories existed get PLATFORM when the issuer is a
-- super admin or the payer is a park (same rule as invoiceCategoryForRole).
UPDATE "Invoice" AS i
SET "category" = 'PLATFORM'
FROM "User" AS u
WHERE i."createdById" = u."id"
  AND i."category" = 'CHARGE'
  AND u."role" = 'SUPER_ADMIN';

UPDATE "Invoice"
SET "category" = 'PLATFORM'
WHERE "category" = 'CHARGE'
  AND "targetType" = 'PARK';
