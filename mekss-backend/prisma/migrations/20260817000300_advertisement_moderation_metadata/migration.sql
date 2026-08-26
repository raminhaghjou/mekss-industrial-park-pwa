-- Add durable, nullable moderation scope and actor metadata without rewriting legacy identities or terminal states.
ALTER TABLE "Advertisement"
  ADD COLUMN "parkId" TEXT,
  ADD COLUMN "moderatedById" TEXT,
  ADD COLUMN "moderatedAt" TIMESTAMP(3);

-- A creator's park is inferred only when every existing factory/park-manager relationship points to one distinct park.
-- Creators with no relationship or relationships to multiple parks intentionally remain unscoped (NULL).
WITH "CreatorParkCandidates" AS (
  SELECT "managerId" AS "creatorId", "parkId"
  FROM "Factory"
  UNION
  SELECT "B" AS "creatorId", "A" AS "parkId"
  FROM "_ParkManager"
),
"UnambiguousCreatorParks" AS (
  SELECT "creatorId", MIN("parkId") AS "parkId"
  FROM "CreatorParkCandidates"
  GROUP BY "creatorId"
  HAVING COUNT(DISTINCT "parkId") = 1
)
UPDATE "Advertisement" AS advertisement
SET "parkId" = scope."parkId"
FROM "UnambiguousCreatorParks" AS scope
WHERE advertisement."createdById" = scope."creatorId"
  AND advertisement."parkId" IS NULL;

CREATE INDEX "Advertisement_parkId_status_idx" ON "Advertisement"("parkId", "status");
CREATE INDEX "Advertisement_moderatedById_moderatedAt_idx" ON "Advertisement"("moderatedById", "moderatedAt");

ALTER TABLE "Advertisement"
  ADD CONSTRAINT "Advertisement_parkId_fkey"
    FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Advertisement_moderatedById_fkey"
    FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
