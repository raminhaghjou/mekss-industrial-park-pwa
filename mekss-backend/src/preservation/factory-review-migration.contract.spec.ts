import { readFileSync } from 'fs';
import { resolve } from 'path';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260828000300_factory_review_metadata/migration.sql'),
  'utf8',
);

const model = (name: string): string => {
  const block = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  if (!block) throw new Error(`Missing Prisma model: ${name}`);
  return block[0];
};
const factoryModel = model('Factory');
const userModel = model('User');
const normalizedMigration = migration.replace(/^--.*$/gm, '').replace(/\s+/g, ' ').trim();

describe('factory review metadata migration contract', () => {
  test('models nullable review metadata and a non-owning reviewer relation', () => {
    expect(factoryModel).toMatch(/rejectionReason\s+String\?/);
    expect(factoryModel).toMatch(/reviewedAt\s+DateTime\?/);
    expect(factoryModel).toMatch(/reviewedById\s+String\?/);
    expect(userModel).toMatch(/reviewedFactories\s+Factory\[\]\s+@relation\("FactoryReviewer"\)/);
    expect(factoryModel).toContain('@relation("FactoryReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)');
  });

  test('adds only nullable columns, supporting indexes, and a SET NULL foreign key', () => {
    expect(migration).toContain('ADD COLUMN "rejectionReason" TEXT,');
    expect(migration).toContain('ADD COLUMN "reviewedById" TEXT,');
    expect(migration).toContain('ADD COLUMN "reviewedAt" TIMESTAMP(3);');
    expect(migration).not.toMatch(/ADD COLUMN "(?:rejectionReason|reviewedById|reviewedAt)"[^,;]*NOT NULL/i);
    expect(migration).not.toMatch(/ADD COLUMN "(?:rejectionReason|reviewedById|reviewedAt)"[^,;]*DEFAULT/i);
    expect(migration).toContain('CREATE INDEX "Factory_parkId_status_isApproved_idx" ON "Factory"("parkId", "status", "isApproved")');
    expect(migration).toContain('CREATE INDEX "Factory_reviewedById_reviewedAt_idx" ON "Factory"("reviewedById", "reviewedAt")');
    expect(migration).toContain('CONSTRAINT "Factory_reviewedById_fkey"');
    expect(migration).toContain('FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE');
    expect(migration.match(/ON DELETE SET NULL/g)).toHaveLength(1);
    expect(normalizedMigration).toBe(
      'ALTER TABLE "Factory" ADD COLUMN "rejectionReason" TEXT, ADD COLUMN "reviewedById" TEXT, ADD COLUMN "reviewedAt" TIMESTAMP(3); '
      + 'CREATE INDEX "Factory_parkId_status_isApproved_idx" ON "Factory"("parkId", "status", "isApproved"); '
      + 'CREATE INDEX "Factory_reviewedById_reviewedAt_idx" ON "Factory"("reviewedById", "reviewedAt"); '
      + 'ALTER TABLE "Factory" ADD CONSTRAINT "Factory_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;',
    );
  });

  test('does not backfill, rewrite status, or remove legacy data and relations', () => {
    expect(migration).not.toMatch(/^\s*(?:WITH|UPDATE|INSERT|DELETE|MERGE|TRUNCATE|DROP)\b/im);
    expect(migration).not.toMatch(/\bRENAME\b/i);
    expect(migration).not.toMatch(/ALTER\s+COLUMN/i);
    expect(migration).not.toMatch(/ADD\s+COLUMN\s+"(?:id|status|isApproved|managerId|parkId)"/i);

    expect(factoryModel).toMatch(/id\s+String\s+@id\s+@default\(cuid\(\)\)/);
    expect(factoryModel).toMatch(/status\s+FactoryStatus\s+@default\(PENDING\)/);
    expect(factoryModel).toMatch(/isApproved\s+Boolean\s+@default\(false\)/);
    expect(factoryModel).toContain('@relation("FactoryOwner", fields: [managerId], references: [id])');
    expect(factoryModel).toContain('park          IndustrialPark    @relation(fields: [parkId], references: [id])');
    expect(schema).toMatch(/enum FactoryStatus\s*{\s*PENDING\s+ACTIVE\s+INACTIVE\s+SUSPENDED\s*}/);
  });
});
