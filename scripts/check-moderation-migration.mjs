import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import process from 'node:process';
import { PrismaClient } from '../mekss-backend/node_modules/@prisma/client/index.js';

const backendUrl = new URL('../mekss-backend/', import.meta.url);
const TEST_OPT_IN = 'MEKSS_TEST_DATABASE';
const SCHEMA_PREFIX = 'mekss_test_moderation_';
const TARGET_MIGRATION = '20260817000300_advertisement_moderation_metadata';
const PREVIOUS_MIGRATIONS = [
  '20260817000000_initial_schema',
  '20260817000100_emergency_alert',
  '20260817000200_production_persistence_invariants',
];

function fail(message) {
  throw new Error(`[moderation-migration] ${message}`);
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
      const result = { code: code ?? 1, signal, stdout, stderr };
      if (code === 0) resolvePromise(result);
      else {
        const error = new Error(`${executable} ${args.slice(0, 3).join(' ')} failed (${signal || `exit ${code ?? 1}`})`);
        Object.assign(error, result);
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

async function snapshot(client) {
  const definitions = {
    users: `SELECT id, "phoneNumber", username, password, name, "nationalId", email, role::text, "isApproved", "isActive", "mustChangePassword", "bootstrapKey", "bootstrapCreatedAt", avatar, "createdAt", "updatedAt", "lastLoginAt" FROM "User" ORDER BY id`,
    parks: `SELECT id, code, name, province, city, address, "phoneNumber", email, "guardPhone", "totalArea", "totalFactories", "activeFactories", "establishedDate", description, logo, status::text, "createdAt", "updatedAt" FROM "IndustrialPark" ORDER BY id`,
    factories: `SELECT id, name, "licenseNumber", "licenseExpiry", "nationalId", "activityType", address, location, "phoneNumber", email, website, description, "establishedDate", employees, status::text, "isApproved", "createdAt", "updatedAt", "managerId", "parkId" FROM "Factory" ORDER BY id`,
    advertisements: `SELECT id, title, category::text, province, city, content, price::text, "contactInfo", images, status::text, "isApproved", "rejectionReason", "createdAt", "updatedAt", "expiresAt", "createdById" FROM "Advertisement" ORDER BY id`,
    audits: `SELECT id, "actorIdentifier", action, entity, "entityId", changes, result::text, "correlationId", "ipAddress", "userAgent", "createdAt", "userId" FROM "AuditLog" ORDER BY id`,
    parkManagers: `SELECT "A", "B" FROM "_ParkManager" ORDER BY "A", "B"`,
  };
  const result = {};
  for (const [name, query] of Object.entries(definitions)) {
    result[name] = await client.$queryRawUnsafe(query);
  }
  return JSON.parse(JSON.stringify(result));
}

const FIXTURE_SQL = `
INSERT INTO "User" (id, "phoneNumber", password, name, role, "isApproved", "isActive", "createdAt", "updatedAt") VALUES
  ('creator-factory', '09120001001', 'fixture-hash', 'Factory Creator', 'FACTORY_OWNER', true, true, '2026-01-01', '2026-01-01'),
  ('creator-manager', '09120001002', 'fixture-hash', 'Park Manager Creator', 'PARK_MANAGER', true, true, '2026-01-01', '2026-01-01'),
  ('creator-ambiguous', '09120001003', 'fixture-hash', 'Ambiguous Creator', 'FACTORY_OWNER', true, true, '2026-01-01', '2026-01-01'),
  ('creator-unscoped', '09120001004', 'fixture-hash', 'Unscoped Creator', 'EMPLOYEE', true, true, '2026-01-01', '2026-01-01'),
  ('creator-same-scope', '09120001005', 'fixture-hash', 'Same Scope Creator', 'PARK_MANAGER', true, true, '2026-01-01', '2026-01-01'),
  ('moderator-fixture', '09120001006', 'fixture-hash', 'Audited Moderator', 'SUPER_ADMIN', true, true, '2026-01-01', '2026-01-01'),
  ('moderator-delete-check', '09120001007', 'fixture-hash', 'Delete Check Moderator', 'SUPER_ADMIN', true, true, '2026-01-01', '2026-01-01');


INSERT INTO "IndustrialPark" (id, code, name, province, city, address, "phoneNumber", "guardPhone", "createdAt", "updatedAt") VALUES
  ('park-a', 'PARK-A', 'Park A', 'Province A', 'City A', 'Address A', '02100001001', '02100001901', '2026-01-01', '2026-01-01'),
  ('park-b', 'PARK-B', 'Park B', 'Province B', 'City B', 'Address B', '02100001002', '02100001902', '2026-01-01', '2026-01-01'),
  ('park-delete-check', 'PARK-DELETE', 'Delete Check Park', 'Province C', 'City C', 'Address C', '02100001003', '02100001903', '2026-01-01', '2026-01-01');

INSERT INTO "Factory" (id, name, "licenseNumber", "nationalId", "activityType", address, "phoneNumber", status, "isApproved", "createdAt", "updatedAt", "managerId", "parkId") VALUES
  ('factory-single', 'Factory Single', 'LIC-SINGLE', '14000001001', 'Test', 'Address', '02100002001', 'ACTIVE', true, '2026-01-01', '2026-01-01', 'creator-factory', 'park-a'),
  ('factory-ambiguous-a', 'Factory Ambiguous A', 'LIC-AMB-A', '14000001002', 'Test', 'Address', '02100002002', 'ACTIVE', true, '2026-01-01', '2026-01-01', 'creator-ambiguous', 'park-a'),
  ('factory-ambiguous-b', 'Factory Ambiguous B', 'LIC-AMB-B', '14000001003', 'Test', 'Address', '02100002003', 'ACTIVE', true, '2026-01-01', '2026-01-01', 'creator-ambiguous', 'park-b'),
  ('factory-same-scope', 'Factory Same Scope', 'LIC-SAME', '14000001004', 'Test', 'Address', '02100002004', 'ACTIVE', true, '2026-01-01', '2026-01-01', 'creator-same-scope', 'park-a');

INSERT INTO "_ParkManager" ("A", "B") VALUES
  ('park-b', 'creator-manager'),
  ('park-a', 'creator-same-scope');

INSERT INTO "Advertisement" (id, title, category, province, city, content, price, "contactInfo", images, status, "isApproved", "rejectionReason", "createdAt", "updatedAt", "expiresAt", "createdById") VALUES
  ('ad-single-factory', 'Single factory scope', 'EQUIPMENT', 'A', 'A', 'Content A', 10.00, '{"phone":"09120000001"}', ARRAY['a.jpg'], 'PENDING', false, NULL, '2026-01-01', '2026-01-01', NULL, 'creator-factory'),
  ('ad-single-manager', 'Single manager scope', 'SERVICES', 'B', 'B', 'Content B', NULL, '{"phone":"09120000002"}', ARRAY[]::TEXT[], 'APPROVED', true, NULL, '2026-01-02', '2026-01-02', '2027-01-01', 'creator-manager'),
  ('ad-ambiguous', 'Ambiguous scope', 'RAW_MATERIALS', 'A', 'B', 'Content C', 20.00, '{"phone":"09120000003"}', ARRAY['c.jpg'], 'REJECTED', false, 'Legacy rejection', '2026-01-03', '2026-01-03', NULL, 'creator-ambiguous'),
  ('ad-unscoped', 'No scope', 'OTHER', 'C', 'C', 'Content D', NULL, '{"phone":"09120000004"}', ARRAY[]::TEXT[], 'EXPIRED', false, NULL, '2026-01-04', '2026-01-04', NULL, 'creator-unscoped'),
  ('ad-same-scope', 'Same scope through two relations', 'JOB_LISTINGS', 'A', 'A', 'Content E', NULL, '{"phone":"09120000005"}', ARRAY[]::TEXT[], 'APPROVED', true, NULL, '2026-01-05', '2026-01-05', NULL, 'creator-same-scope');

INSERT INTO "AuditLog" (id, "actorIdentifier", action, entity, "entityId", changes, result, "correlationId", "createdAt", "userId") VALUES
  ('audit-legacy-ad', 'moderator-fixture', 'LEGACY_OBSERVATION', 'Advertisement', 'ad-ambiguous', '{"status":"REJECTED"}', 'SUCCESS', 'migration-fixture', '2026-01-06', 'moderator-fixture');
`;

async function verifySchemaMetadata(client, expectedParkDeleteAction = 'n') {
  const columns = await client.$queryRawUnsafe(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Advertisement'
      AND column_name IN ('parkId', 'moderatedById', 'moderatedAt')
    ORDER BY column_name
  `);
  assert.deepEqual(columns, [
    { column_name: 'moderatedAt', is_nullable: 'YES' },
    { column_name: 'moderatedById', is_nullable: 'YES' },
    { column_name: 'parkId', is_nullable: 'YES' },
  ]);

  const indexes = await client.$queryRawUnsafe(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN ('Advertisement_parkId_status_idx', 'Advertisement_moderatedById_moderatedAt_idx')
    ORDER BY indexname
  `);
  assert.deepEqual(indexes.map((row) => row.indexname), [
    'Advertisement_moderatedById_moderatedAt_idx',
    'Advertisement_parkId_status_idx',
  ]);

  const deleteActions = await client.$queryRawUnsafe(`
    SELECT conname, confdeltype
    FROM pg_constraint
    WHERE connamespace = current_schema()::regnamespace
      AND conname IN ('Advertisement_parkId_fkey', 'Advertisement_moderatedById_fkey')
    ORDER BY conname
  `);
  assert.deepEqual(deleteActions, [
    { conname: 'Advertisement_moderatedById_fkey', confdeltype: 'n' },
    { conname: 'Advertisement_parkId_fkey', confdeltype: expectedParkDeleteAction },
  ]);
}

async function verifyBackfill(client) {
  const rows = await client.$queryRawUnsafe(`SELECT id, "parkId", "moderatedById", "moderatedAt" FROM "Advertisement" ORDER BY id`);
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.equal(byId['ad-single-factory'].parkId, 'park-a');
  assert.equal(byId['ad-single-manager'].parkId, 'park-b');
  assert.equal(byId['ad-same-scope'].parkId, 'park-a');
  assert.equal(byId['ad-ambiguous'].parkId, null);
  assert.equal(byId['ad-unscoped'].parkId, null);
  for (const row of rows) {
    assert.equal(row.moderatedById, null);
    assert.equal(row.moderatedAt, null);
  }
}

async function createSchema(baseUrl, schema) {
  await executeSql(baseUrl.toString(), `CREATE SCHEMA "${schema}";\n`);
}

async function dropSchema(baseUrl, schema) {
  await executeSql(baseUrl.toString(), `DROP SCHEMA IF EXISTS "${schema}" CASCADE;\n`);
}

const baseUrl = safeBaseUrl(process.env);
const runId = `${Date.now().toString(36)}_${process.pid}_${randomBytes(3).toString('hex')}`.toLowerCase();
const snapshotSchema = `${SCHEMA_PREFIX}${runId}_snapshot`;
const deploySchema = `${SCHEMA_PREFIX}${runId}_deploy`;
const rollbackSchema = `${SCHEMA_PREFIX}${runId}_rollback`;
const schemas = [snapshotSchema, deploySchema, rollbackSchema];
const environment = { ...process.env, NODE_ENV: 'test', MEKSS_TEST_DATABASE: '1' };
let snapshotClient;
let deployClient;
let rollbackClient;
let failed = false;

console.log(`[moderation-migration] isolated database=${decodeURIComponent(baseUrl.pathname.slice(1))} host=${baseUrl.hostname}`);
console.log(`[moderation-migration] fixture-seed=0x34a11 schemas=${schemas.join(',')}`);

try {
  for (const schema of schemas) await createSchema(baseUrl, schema);

  const deployUrl = schemaUrl(baseUrl, deploySchema);
  await run('npx', ['prisma', 'migrate', 'deploy'], { env: { ...environment, DATABASE_URL: deployUrl } });
  await run('npx', ['prisma', 'migrate', 'deploy'], { env: { ...environment, DATABASE_URL: deployUrl } });
  deployClient = new PrismaClient({ datasources: { db: { url: deployUrl } } });
  await verifySchemaMetadata(deployClient, 'r');

  const snapshotUrl = schemaUrl(baseUrl, snapshotSchema);
  for (const migration of PREVIOUS_MIGRATIONS) {
    await executeFile(snapshotUrl, `prisma/migrations/${migration}/migration.sql`, { env: environment });
  }
  await executeSql(snapshotUrl, FIXTURE_SQL, { env: environment });
  snapshotClient = new PrismaClient({ datasources: { db: { url: snapshotUrl } } });
  const before = await snapshot(snapshotClient);

  await executeFile(snapshotUrl, `prisma/migrations/${TARGET_MIGRATION}/migration.sql`, { env: environment });
  const after = await snapshot(snapshotClient);
  assert.deepEqual(after, before, 'legacy data, IDs, relations, statuses, and audit rows must remain byte-equivalent');
  await verifySchemaMetadata(snapshotClient);
  await verifyBackfill(snapshotClient);

  await snapshotClient.$executeRawUnsafe(`UPDATE "Advertisement" SET "parkId" = 'park-delete-check', "moderatedById" = 'moderator-delete-check', "moderatedAt" = '2026-02-01' WHERE id = 'ad-unscoped'`);
  await snapshotClient.$executeRawUnsafe(`DELETE FROM "User" WHERE id = 'moderator-delete-check'`);
  await snapshotClient.$executeRawUnsafe(`DELETE FROM "IndustrialPark" WHERE id = 'park-delete-check'`);
  const retained = await snapshotClient.$queryRawUnsafe(`SELECT id, "parkId", "moderatedById", "moderatedAt" FROM "Advertisement" WHERE id = 'ad-unscoped'`);
  assert.equal(retained[0].id, 'ad-unscoped');
  assert.equal(retained[0].parkId, null);
  assert.equal(retained[0].moderatedById, null);
  assert.notEqual(retained[0].moderatedAt, null);

  let rollbackRefused = false;
  try {
    await executeFile(snapshotUrl, `prisma/migrations/${TARGET_MIGRATION}/rollback.sql`, { env: environment, capture: true });
  } catch (error) {
    rollbackRefused = error.stderr.includes('Refusing moderation metadata rollback');
  }
  assert.equal(rollbackRefused, true, 'rollback must refuse to discard populated moderation metadata');

  const rollbackUrl = schemaUrl(baseUrl, rollbackSchema);
  for (const migration of PREVIOUS_MIGRATIONS) {
    await executeFile(rollbackUrl, `prisma/migrations/${migration}/migration.sql`, { env: environment });
  }
  await executeFile(rollbackUrl, `prisma/migrations/${TARGET_MIGRATION}/migration.sql`, { env: environment });
  rollbackClient = new PrismaClient({ datasources: { db: { url: rollbackUrl } } });
  await rollbackClient.$executeRawUnsafe(`
    INSERT INTO "User" (id, "phoneNumber", password, name, role, "isApproved", "isActive", "createdAt", "updatedAt")
    VALUES ('rollback-user', '09120001999', 'fixture-hash', 'Rollback User', 'EMPLOYEE', true, true, '2026-01-01', '2026-01-01')
  `);
  await rollbackClient.$executeRawUnsafe(`
    INSERT INTO "Advertisement" (id, title, category, province, city, content, "contactInfo", images, status, "isApproved", "createdAt", "updatedAt", "createdById")
    VALUES ('rollback-ad', 'Rollback ad', 'OTHER', 'A', 'A', 'Legacy payload', '{}', ARRAY[]::TEXT[], 'PENDING', false, '2026-01-01', '2026-01-01', 'rollback-user')
  `);
  const rollbackBefore = await rollbackClient.$queryRawUnsafe(`SELECT id, title, status::text, "createdById" FROM "Advertisement" WHERE id = 'rollback-ad'`);
  await executeFile(rollbackUrl, `prisma/migrations/${TARGET_MIGRATION}/rollback.sql`, { env: environment });
  const rollbackAfter = await rollbackClient.$queryRawUnsafe(`SELECT id, title, status::text, "createdById" FROM "Advertisement" WHERE id = 'rollback-ad'`);
  assert.deepEqual(rollbackAfter, rollbackBefore);
  const removedColumns = await rollbackClient.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Advertisement'
      AND column_name IN ('parkId', 'moderatedById', 'moderatedAt')
  `);
  assert.equal(removedColumns.length, 0);

  console.log('[moderation-migration] PASS deploy-idempotency nullable-columns indexes final-delete-actions');
  console.log('[moderation-migration] PASS populated-snapshot legacy-identities-relations-statuses-audits');
  console.log('[moderation-migration] PASS unambiguous-backfill ambiguous-and-unscoped-remain-null');
  console.log('[moderation-migration] PASS rollback-refusal-and-empty-metadata-rollback-boundary');
} catch (error) {
  failed = true;
  console.error(`[moderation-migration] FAIL ${error.message}`);
} finally {
  if (snapshotClient) await snapshotClient.$disconnect().catch(() => undefined);
  if (deployClient) await deployClient.$disconnect().catch(() => undefined);
  if (rollbackClient) await rollbackClient.$disconnect().catch(() => undefined);
  for (const schema of schemas.reverse()) {
    try {
      await dropSchema(baseUrl, schema);
      console.log(`[moderation-migration] removed owned schema=${schema}`);
    } catch (error) {
      failed = true;
      console.error(`[moderation-migration] cleanup failed schema=${schema}: ${error.message}`);
    }
  }
}

process.exitCode = failed ? 1 : 0;
