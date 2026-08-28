import { readFileSync } from 'fs';
import { resolve } from 'path';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260817000300_advertisement_moderation_metadata/migration.sql'),
  'utf8',
);
const rollback = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260817000300_advertisement_moderation_metadata/rollback.sql'),
  'utf8',
);

describe('advertisement moderation migration contract', () => {
  test('models explicit nullable creator, park, and moderator relations', () => {
    expect(schema).toMatch(/advertisements\s+Advertisement\[\]\s+@relation\("AdvertisementCreator"\)/);
    expect(schema).toMatch(/moderatedAdvertisements\s+Advertisement\[\]\s+@relation\("AdvertisementModerator"\)/);
    expect(schema).toMatch(/advertisements\s+Advertisement\[\]\s+@relation\("AdvertisementPark"\)/);
    expect(schema).toContain('@relation("AdvertisementCreator", fields: [createdById], references: [id], onDelete: Restrict)');
    expect(schema).toContain('@relation("AdvertisementPark", fields: [parkId], references: [id], onDelete: Restrict)');
    expect(schema).toContain('@relation("AdvertisementModerator", fields: [moderatedById], references: [id], onDelete: SetNull)');
    expect(schema).toMatch(/moderatedAt\s+DateTime\?/);
  });

  test('uses additive nullable columns and an ambiguity-safe backfill', () => {
    for (const field of ['parkId', 'moderatedById', 'moderatedAt']) {
      expect(migration).toContain(`ADD COLUMN "${field}"`);
    }
    expect(migration).toContain('HAVING COUNT(DISTINCT "parkId") = 1');
    expect(migration).toContain('AND advertisement."parkId" IS NULL');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/UPDATE\s+"Advertisement"[\s\S]*"status"\s*=/i);
  });

  test('keeps both new foreign keys non-cascading and protects manual rollback', () => {
    expect(migration.match(/ON DELETE SET NULL/g)).toHaveLength(2);
    expect(rollback).toContain('Refusing moderation metadata rollback');
    expect(rollback).toContain('"parkId" IS NOT NULL');
    expect(rollback).toContain('"moderatedById" IS NOT NULL');
    expect(rollback).toContain('"moderatedAt" IS NOT NULL');
    expect(rollback).not.toMatch(/DROP\s+TABLE/i);
  });
});
