import { readFileSync } from 'fs';
import { resolve } from 'path';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260828000200_user_session_version/migration.sql'),
  'utf8',
);

describe('user session-version migration contract', () => {
  test('adds a non-negative zero-default access-token epoch without rewriting identities', () => {
    expect(schema).toMatch(/sessionVersion\s+Int\s+@default\(0\)/);
    expect(migration).toContain('ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0');
    expect(migration).toContain('CHECK ("sessionVersion" >= 0)');
    expect(migration).toContain('case/whitespace-insensitive duplicates exist');
    expect(migration).toContain('NULLIF(lower(btrim("email")), \'\')');
    expect(migration).toContain('NULLIF(lower(btrim("username")), \'\')');
    expect(migration).toContain('CONSTRAINT "User_email_canonical"');
    expect(migration).toContain('CONSTRAINT "User_username_canonical"');
    expect(migration).not.toMatch(/\b(DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i);
  });

  test('keeps audit rows immutable except for FK-driven userId detachment', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()');
    expect(migration).toContain('OLD."userId" IS NOT NULL');
    expect(migration).toContain('NEW."userId" IS NULL');
    expect(migration).toContain("(to_jsonb(NEW) - 'userId') = (to_jsonb(OLD) - 'userId')");
    expect(migration).toContain("RAISE EXCEPTION 'AuditLog is append-only'");
  });
});
