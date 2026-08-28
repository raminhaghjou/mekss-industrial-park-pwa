import { readFileSync } from 'fs';
import { resolve } from 'path';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260828000100_park_delete_integrity/migration.sql'),
  'utf8',
);

describe('industrial-park delete integrity migration contract', () => {
  test('models every nullable park business relation as restrictive', () => {
    expect(schema).toContain('@relation(fields: [parkId], references: [id], onDelete: Restrict)');
    expect(schema).toContain('@relation("AdvertisementPark", fields: [parkId], references: [id], onDelete: Restrict)');
    expect(schema).toContain('@relation("FeedbackRecipientPark", fields: [recipientParkId], references: [id], onDelete: Restrict)');
    expect(schema).toMatch(/securityGuards\s+SecurityGuard\[\]/);
    expect(schema).toMatch(/scopedFiles\s+ScopedFile\[\]/);
    expect(schema).toMatch(/feedback\s+Feedback\[\]\s+@relation\("FeedbackRecipientPark"\)/);
  });

  test('replaces every unsafe park delete action with RESTRICT', () => {
    for (const constraint of [
      'Announcement_parkId_fkey',
      'Advertisement_parkId_fkey',
      'SecurityGuard_parkId_fkey',
      'Feedback_recipientParkId_fkey',
    ]) {
      expect(migration).toContain(`CONSTRAINT "${constraint}"`);
    }
    expect(migration.match(/ON DELETE RESTRICT/g)).toHaveLength(4);
    expect(migration).not.toMatch(/ON DELETE (CASCADE|SET NULL)/);
  });

  test('preserves legacy rows while enforcing new feedback references', () => {
    expect(migration).toContain('Feedback_recipientParkId_fkey');
    expect(migration).toContain('NOT VALID');
    expect(migration).toMatch(/^--[\s\S]*BEGIN;[\s\S]*COMMIT;\s*$/);
    expect(migration).not.toMatch(/\b(DELETE\s+FROM|UPDATE\s+"|TRUNCATE)\b/i);
  });
});
