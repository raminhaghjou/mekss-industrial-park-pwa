import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import process from 'node:process';

const TEST_DATABASE_OPT_IN = 'MEKSS_TEST_DATABASE';
const OWNED_SCHEMA_PREFIX = 'mekss_test_';

function fail(message) {
  throw new Error(`[database-safety] ${message}`);
}

function parseSafeBaseUrl(environment) {
  if (environment[TEST_DATABASE_OPT_IN] !== '1') {
    fail(`${TEST_DATABASE_OPT_IN}=1 is required to acknowledge use of a disposable test database.`);
  }
  const raw = environment.DATABASE_URL;
  if (!raw) fail('DATABASE_URL is required; environment files are never loaded implicitly.');

  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) fail('Only PostgreSQL test databases are supported.');

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, '')).toLowerCase();
  if (!databaseName || !/(^|[_-])(test|ci)([_-]|$)/.test(databaseName)) {
    fail('The database name must contain a distinct "test" or "ci" segment.');
  }
  if (/\b(prod|production|live)\b/i.test(`${url.hostname}/${databaseName}`)) {
    fail('Production-like host or database names are forbidden.');
  }

  const configuredSchema = url.searchParams.get('schema');
  if (configuredSchema && !configuredSchema.startsWith(OWNED_SCHEMA_PREFIX)) {
    fail(`Configured schema must start with ${OWNED_SCHEMA_PREFIX} when provided.`);
  }
  url.searchParams.delete('schema');
  return url;
}

function ownedSchemaName(environment) {
  const supplied = environment.MEKSS_TEST_RUN_ID;
  const suffix = supplied || `${Date.now().toString(36)}_${process.pid}_${randomBytes(3).toString('hex')}`;
  const normalized = suffix.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
  if (!normalized) fail('MEKSS_TEST_RUN_ID must include letters or numbers.');
  return `${OWNED_SCHEMA_PREFIX}${normalized}`;
}

function run(executable, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, args, {
      cwd: new URL('../mekss-backend/', import.meta.url),
      env: options.env,
      shell: process.platform === 'win32',
      stdio: options.input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    });
    if (options.input !== undefined) child.stdin.end(options.input);
    child.on('error', rejectPromise);
    child.on('close', (code, signal) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${executable} ${args.join(' ')} failed (${signal || `exit ${code ?? 1}`})`));
    });
  });
}

const npmCommand = 'npx';
let baseUrl;
try {
  baseUrl = parseSafeBaseUrl(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const schema = ownedSchemaName(process.env);
const testUrl = new URL(baseUrl);
testUrl.searchParams.set('schema', schema);
const testEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: testUrl.toString(),
  MEKSS_OWNED_TEST_SCHEMA: schema,
};

console.log(`[database-safety] isolated schema=${schema} database=${decodeURIComponent(baseUrl.pathname.slice(1))} host=${baseUrl.hostname}`);
if (process.argv.includes('--check-only')) process.exit(0);

let testFailed = false;
try {
  await run(npmCommand, ['prisma', 'migrate', 'deploy'], { env: testEnvironment });
  await run(npmCommand, ['jest', '--config', './test/jest-e2e.json', '--runInBand'], { env: testEnvironment });
} catch (error) {
  testFailed = true;
  console.error(`[integration] ${error.message}`);
} finally {
  try {
    await run(
      npmCommand,
      ['prisma', 'db', 'execute', '--stdin', '--url', baseUrl.toString()],
      { env: testEnvironment, input: `DROP SCHEMA IF EXISTS "${schema}" CASCADE;\n` },
    );
    console.log(`[database-safety] removed owned schema=${schema}`);
  } catch (error) {
    console.error(`[database-safety] cleanup failed for owned schema=${schema}: ${error.message}`);
    testFailed = true;
  }
}

process.exitCode = testFailed ? 1 : 0;
