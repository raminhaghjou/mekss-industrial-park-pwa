import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import process from 'node:process';

const backendUrl = new URL('../mekss-backend/', import.meta.url);
const TEST_OPT_IN = 'MEKSS_TEST_DATABASE';
const SCHEMA_PREFIX = 'mekss_test_park_upgrade_';
const TARGET_MIGRATION = '20260828000100_park_delete_integrity';
const PREVIOUS_MIGRATIONS = [
  '20260817000000_initial_schema',
  '20260817000100_emergency_alert',
  '20260817000200_production_persistence_invariants',
  '20260817000300_advertisement_moderation_metadata',
  '20260828000000_schema_alignment',
];

function fail(message) {
  throw new Error(`[park-delete-migration] ${message}`);
}

function safeBaseUrl(environment) {
  if (environment[TEST_OPT_IN] !== '1') fail(`${TEST_OPT_IN}=1 is required.`);
  if (!environment.DATABASE_URL) fail('DATABASE_URL is required and environment files are not loaded implicitly.');
  const url = new URL(environment.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) fail('Only PostgreSQL is supported.');
  const databaseName = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  if (!/(^|[_-])(test|ci)([_-]|$)/.test(databaseName)) fail('Database name must contain a distinct test or ci segment.');
  if (/\b(prod|production|live)\b/i.test(`${url.hostname}/${databaseName}`)) fail('Production-like database targets are forbidden.');
  url.searchParams.delete('schema');
  return url;
}

function schemaUrl(baseUrl, schema) {
  const url = new URL(baseUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

function run(executable, args, { env = process.env, input, capture = false } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, args, {
      cwd: backendUrl,
      env,
      shell: process.platform === 'win32',
      stdio: capture ? ['pipe', 'pipe', 'pipe'] : input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    });
    let stdout = '';
    let stderr = '';
    if (capture) {
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
    }
    if (input !== undefined) child.stdin.end(input);
    child.on('error', rejectPromise);
    child.on('close', (code, signal) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else {
        const error = new Error(`${executable} ${args.slice(0, 3).join(' ')} failed (${signal || `exit ${code ?? 1}`})`);
        Object.assign(error, { code, signal, stdout, stderr });
        rejectPromise(error);
      }
    });
  });
}

async function executeSql(url, input, options = {}) {
  return run('npx', ['prisma', 'db', 'execute', '--stdin', '--url', url], { input, ...options });
}

async function executeFile(url, relativeFile, options = {}) {
  return run('npx', ['prisma', 'db', 'execute', '--file', relativeFile, '--url', url], options);
}

const FIXTURE_SQL = `
INSERT INTO "User" (id, "phoneNumber", password, name, role, "isApproved", "isActive", "createdAt", "updatedAt") VALUES
  ('park-upgrade-admin', '09127777000', 'fixture-hash', 'Upgrade Admin', 'SUPER_ADMIN', true, true, '2026-01-01', '2026-01-01'),
  ('park-upgrade-guard', '09127777001', 'fixture-hash', 'Upgrade Guard', 'SECURITY_GUARD', true, true, '2026-01-01', '2026-01-01');

INSERT INTO "IndustrialPark" (id, code, name, province, city, address, "phoneNumber", "guardPhone", "createdAt", "updatedAt") VALUES
  ('park-announcement', 'UPGRADE-ANN', 'Announcement Park', 'Tehran', 'Tehran', 'Address', '02170000001', '02170000101', '2026-01-01', '2026-01-01'),
  ('park-advertisement', 'UPGRADE-AD', 'Advertisement Park', 'Tehran', 'Tehran', 'Address', '02170000002', '02170000102', '2026-01-01', '2026-01-01'),
  ('park-guard', 'UPGRADE-GUARD', 'Guard Park', 'Tehran', 'Tehran', 'Address', '02170000003', '02170000103', '2026-01-01', '2026-01-01'),
  ('park-feedback', 'UPGRADE-FEEDBACK', 'Feedback Park', 'Tehran', 'Tehran', 'Address', '02170000004', '02170000104', '2026-01-01', '2026-01-01'),
  ('park-eligible', 'UPGRADE-ELIGIBLE', 'Eligible Park', 'Tehran', 'Tehran', 'Address', '02170000005', '02170000105', '2026-01-01', '2026-01-01');

INSERT INTO "Announcement" (id, title, content, "parkId", "createdById", "createdAt", "updatedAt")
VALUES ('upgrade-announcement', 'Legacy announcement', 'Preserved content', 'park-announcement', 'park-upgrade-admin', '2026-01-02', '2026-01-02');

INSERT INTO "Advertisement" (id, title, "categoryId", province, city, content, "contactInfo", images, status, "isApproved", "createdById", "parkId", "createdAt", "updatedAt")
VALUES ('upgrade-advertisement', 'Legacy advertisement', 'adcat_other', 'Tehran', 'Tehran', 'Preserved advertisement', '{"phone":"09127777000"}', ARRAY[]::TEXT[], 'PENDING', false, 'park-upgrade-admin', 'park-advertisement', '2026-01-03', '2026-01-03');

INSERT INTO "SecurityGuard" (id, "shiftStart", "shiftEnd", "isActive", "createdAt", "userId", "parkId")
VALUES ('upgrade-guard-shift', '2026-01-04 06:00:00', '2026-01-04 14:00:00', true, '2026-01-04', 'park-upgrade-guard', 'park-guard');

INSERT INTO "Feedback" (id, subject, body, "recipientParkId", "createdAt", "senderId") VALUES
  ('upgrade-feedback-valid', 'Valid legacy feedback', 'Preserve valid scope', 'park-feedback', '2026-01-05', 'park-upgrade-admin'),
  ('upgrade-feedback-orphan', 'Orphan legacy feedback', 'Preserve historical orphan', 'legacy-missing-park', '2026-01-06', 'park-upgrade-admin');

CREATE TABLE "__ParkDeleteMigrationSnapshot" (
  name TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);
INSERT INTO "__ParkDeleteMigrationSnapshot" (name, payload)
SELECT 'parks', COALESCE(jsonb_agg(to_jsonb(row_value) ORDER BY row_value.id), '[]'::jsonb) FROM "IndustrialPark" row_value;
INSERT INTO "__ParkDeleteMigrationSnapshot" (name, payload)
SELECT 'announcements', COALESCE(jsonb_agg(to_jsonb(row_value) ORDER BY row_value.id), '[]'::jsonb) FROM "Announcement" row_value;
INSERT INTO "__ParkDeleteMigrationSnapshot" (name, payload)
SELECT 'advertisements', COALESCE(jsonb_agg(to_jsonb(row_value) ORDER BY row_value.id), '[]'::jsonb) FROM "Advertisement" row_value;
INSERT INTO "__ParkDeleteMigrationSnapshot" (name, payload)
SELECT 'guards', COALESCE(jsonb_agg(to_jsonb(row_value) ORDER BY row_value.id), '[]'::jsonb) FROM "SecurityGuard" row_value;
INSERT INTO "__ParkDeleteMigrationSnapshot" (name, payload)
SELECT 'feedback', COALESCE(jsonb_agg(to_jsonb(row_value) ORDER BY row_value.id), '[]'::jsonb) FROM "Feedback" row_value;
`;

const VERIFY_SQL = `
DO $$
DECLARE
  relation_name TEXT;
  expected JSONB;
  actual JSONB;
  target_park TEXT;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['parks', 'announcements', 'advertisements', 'guards', 'feedback'] LOOP
    SELECT payload INTO expected FROM "__ParkDeleteMigrationSnapshot" WHERE name = relation_name;
    CASE relation_name
      WHEN 'parks' THEN SELECT COALESCE(jsonb_agg(to_jsonb(row_value) ORDER BY row_value.id), '[]'::jsonb) INTO actual FROM "IndustrialPark" row_value;
      WHEN 'announcements' THEN SELECT COALESCE(jsonb_agg(to_jsonb(row_value) ORDER BY row_value.id), '[]'::jsonb) INTO actual FROM "Announcement" row_value;
      WHEN 'advertisements' THEN SELECT COALESCE(jsonb_agg(to_jsonb(row_value) ORDER BY row_value.id), '[]'::jsonb) INTO actual FROM "Advertisement" row_value;
      WHEN 'guards' THEN SELECT COALESCE(jsonb_agg(to_jsonb(row_value) ORDER BY row_value.id), '[]'::jsonb) INTO actual FROM "SecurityGuard" row_value;
      WHEN 'feedback' THEN SELECT COALESCE(jsonb_agg(to_jsonb(row_value) ORDER BY row_value.id), '[]'::jsonb) INTO actual FROM "Feedback" row_value;
    END CASE;
    IF actual IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'legacy row preservation failed for %', relation_name;
    END IF;
  END LOOP;

  IF (SELECT COUNT(*) FROM pg_constraint
      WHERE connamespace = current_schema()::regnamespace
        AND conname IN ('Announcement_parkId_fkey', 'Advertisement_parkId_fkey', 'SecurityGuard_parkId_fkey', 'Feedback_recipientParkId_fkey')
        AND confdeltype = 'r') <> 4 THEN
    RAISE EXCEPTION 'all park delete constraints must be RESTRICT';
  END IF;
  IF (SELECT convalidated FROM pg_constraint
      WHERE connamespace = current_schema()::regnamespace
        AND conname = 'Feedback_recipientParkId_fkey') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'legacy feedback FK must remain NOT VALID until historical orphans are reconciled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Feedback" WHERE id = 'upgrade-feedback-orphan' AND "recipientParkId" = 'legacy-missing-park') THEN
    RAISE EXCEPTION 'legacy orphan feedback was not preserved';
  END IF;

  BEGIN
    INSERT INTO "Feedback" (id, subject, body, "recipientParkId", "senderId")
    VALUES ('upgrade-feedback-new-orphan', 'Invalid new scope', 'Must fail', 'new-missing-park', 'park-upgrade-admin');
    RAISE EXCEPTION 'new orphan feedback unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  FOREACH target_park IN ARRAY ARRAY['park-announcement', 'park-advertisement', 'park-guard', 'park-feedback'] LOOP
    BEGIN
      DELETE FROM "IndustrialPark" WHERE id = target_park;
      RAISE EXCEPTION 'protected park % was deleted', target_park;
    EXCEPTION WHEN foreign_key_violation THEN
      NULL;
    END;
    IF NOT EXISTS (SELECT 1 FROM "IndustrialPark" WHERE id = target_park) THEN
      RAISE EXCEPTION 'protected park % did not survive failed delete', target_park;
    END IF;
  END LOOP;

  DELETE FROM "IndustrialPark" WHERE id = 'park-eligible';
  IF EXISTS (SELECT 1 FROM "IndustrialPark" WHERE id = 'park-eligible') THEN
    RAISE EXCEPTION 'eligible park delete did not commit';
  END IF;
END $$;
`;

const baseUrl = safeBaseUrl(process.env);
const runId = `${Date.now().toString(36)}_${process.pid}_${randomBytes(3).toString('hex')}`.toLowerCase();
const schema = `${SCHEMA_PREFIX}${runId}`;
const url = schemaUrl(baseUrl, schema);
const environment = { ...process.env, NODE_ENV: 'test', MEKSS_TEST_DATABASE: '1', DATABASE_URL: url };
let failed = false;

console.log(`[park-delete-migration] isolated database=${decodeURIComponent(baseUrl.pathname.slice(1))} host=${baseUrl.hostname} schema=${schema}`);
console.log('[park-delete-migration] legacy fixture includes valid relations and one orphan feedback scope');

try {
  await executeSql(baseUrl.toString(), `CREATE SCHEMA "${schema}";\n`, { env: environment });
  for (const migration of PREVIOUS_MIGRATIONS) {
    await executeFile(url, `prisma/migrations/${migration}/migration.sql`, { env: environment });
  }
  await executeSql(url, FIXTURE_SQL, { env: environment });
  await executeFile(url, `prisma/migrations/${TARGET_MIGRATION}/migration.sql`, { env: environment });
  await executeSql(url, VERIFY_SQL, { env: environment });
  console.log('[park-delete-migration] PASS legacy rows preserved; new writes and deletes are restrictive');
} catch (error) {
  failed = true;
  console.error(error.stderr || error.message);
} finally {
  try {
    await executeSql(baseUrl.toString(), `DROP SCHEMA IF EXISTS "${schema}" CASCADE;\n`, { env: environment });
    console.log(`[park-delete-migration] removed owned schema=${schema}`);
  } catch (error) {
    failed = true;
    console.error(`[park-delete-migration] cleanup failed: ${error.stderr || error.message}`);
  }
}

process.exitCode = failed ? 1 : 0;
