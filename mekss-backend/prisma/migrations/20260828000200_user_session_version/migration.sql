-- Access-token revocation epoch. Existing users and pre-deployment tokens remain at epoch zero;
-- later credential/access mutations atomically increment this value.
ALTER TABLE "User"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User"
ADD CONSTRAINT "User_sessionVersion_nonnegative" CHECK ("sessionVersion" >= 0);

-- Canonical email/username uniqueness must also hold for legacy and non-admin writers.
-- Refuse an ambiguous deployment instead of silently merging two existing identities.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE "email" IS NOT NULL AND btrim("email") <> ''
    GROUP BY lower(btrim("email")) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize User.email: case/whitespace-insensitive duplicates exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE "username" IS NOT NULL AND btrim("username") <> ''
    GROUP BY lower(btrim("username")) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize User.username: case/whitespace-insensitive duplicates exist';
  END IF;
END;
$$;

UPDATE "User"
SET "email" = NULLIF(lower(btrim("email")), '')
WHERE "email" IS DISTINCT FROM NULLIF(lower(btrim("email")), '');

UPDATE "User"
SET "username" = NULLIF(lower(btrim("username")), '')
WHERE "username" IS DISTINCT FROM NULLIF(lower(btrim("username")), '');

ALTER TABLE "User"
ADD CONSTRAINT "User_email_canonical" CHECK ("email" IS NULL OR "email" = lower(btrim("email"))),
ADD CONSTRAINT "User_username_canonical" CHECK ("username" IS NULL OR "username" = lower(btrim("username")));

-- Audit rows remain append-only, but the existing User -> AuditLog ON DELETE SET NULL
-- foreign key must be able to detach the nullable database key. actorIdentifier remains
-- durable, and every other column must be byte-for-byte equivalent.
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."userId" IS NOT NULL
     AND NEW."userId" IS NULL
     AND (to_jsonb(NEW) - 'userId') = (to_jsonb(OLD) - 'userId') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;
