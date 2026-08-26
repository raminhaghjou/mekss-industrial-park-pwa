-- Manual emergency rollback boundary; Prisma migrate deploy never executes this file automatically.
-- Rollback is refused while any newly introduced scope or moderation metadata would be lost.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Advertisement"
    WHERE "parkId" IS NOT NULL
       OR "moderatedById" IS NOT NULL
       OR "moderatedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Refusing moderation metadata rollback: new advertisement metadata is still present';
  END IF;
END;
$$;

ALTER TABLE "Advertisement"
  DROP CONSTRAINT "Advertisement_moderatedById_fkey",
  DROP CONSTRAINT "Advertisement_parkId_fkey";

DROP INDEX "Advertisement_moderatedById_moderatedAt_idx";
DROP INDEX "Advertisement_parkId_status_idx";

ALTER TABLE "Advertisement"
  DROP COLUMN "moderatedAt",
  DROP COLUMN "moderatedById",
  DROP COLUMN "parkId";
