import { spawn } from 'node:child_process';
import process from 'node:process';

const rawRunId = process.env.MEKSS_TEST_RUN_ID || `${Date.now().toString(36)}-${process.pid}`;
const runId = rawRunId.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
if (!runId) throw new Error('MEKSS_TEST_RUN_ID must contain letters or numbers.');

const project = `mekss-test-${runId}`;
const portOffset = process.pid % 1000;
const backendPort = String(Number(process.env.MEKSS_TEST_BACKEND_PORT || 33000 + portOffset));
const frontendPort = String(Number(process.env.MEKSS_TEST_FRONTEND_PORT || 35000 + portOffset));
const composeArgs = ['compose', '-p', project, '-f', 'mekss-backend/docker-compose.yml'];
const environment = {
  ...process.env,
  COMPOSE_PROJECT_NAME: project,
  MEKSS_LOCAL_POSTGRES_DB: `mekss_test_${runId.replaceAll('-', '_')}`,
  MEKSS_LOCAL_POSTGRES_USER: 'mekss_test',
  MEKSS_LOCAL_POSTGRES_PASSWORD: `test-only-${runId}`,
  MEKSS_LOCAL_MINIO_ROOT_USER: 'mekss_test_minio',
  MEKSS_LOCAL_MINIO_ROOT_PASSWORD: `test-only-minio-${runId}`,
  MEKSS_LOCAL_JWT_SECRET: `test-only-jwt-${runId}-not-production`,
  MEKSS_LOCAL_SESSION_SECRET: `test-only-session-${runId}-not-production`,
  MEKSS_LOCAL_BACKEND_PORT: backendPort,
  MEKSS_LOCAL_FRONTEND_PORT: frontendPort,
};

function run(args, allowFailure = false) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('docker', [...composeArgs, ...args], {
      cwd: new URL('../', import.meta.url),
      env: environment,
      shell: false,
      stdio: 'inherit',
    });
    child.on('error', rejectPromise);
    child.on('close', (code, signal) => {
      if (code === 0 || allowFailure) resolvePromise(code ?? 1);
      else rejectPromise(new Error(`docker ${[...composeArgs, ...args].join(' ')} failed (${signal || `exit ${code ?? 1}`})`));
    });
  });
}

async function assertHttp(url, expectedStatus = 200) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (response.status !== expectedStatus) throw new Error(`${url} returned ${response.status}, expected ${expectedStatus}`);
}

console.log(`[docker-safety] project=${project} database=${environment.MEKSS_LOCAL_POSTGRES_DB} ports=${backendPort}/${frontendPort}`);
let failed = false;
try {
  await run(['config', '--quiet']);
  await run(['up', '--build', '--wait', '--wait-timeout', '300']);
  await assertHttp(`http://127.0.0.1:${backendPort}/health`);
  await assertHttp(`http://127.0.0.1:${frontendPort}/login`);
  console.log(`[docker-smoke] project=${project} result=PASS`);
} catch (error) {
  failed = true;
  console.error(`[docker-smoke] project=${project} result=FAIL: ${error.message}`);
  await run(['ps'], true);
  await run(['logs', '--no-color', '--tail', '200'], true);
} finally {
  const cleanupCode = await run(['down', '--volumes', '--remove-orphans', '--timeout', '10'], true);
  if (cleanupCode !== 0) {
    failed = true;
    console.error(`[docker-safety] cleanup failed for project=${project}`);
  } else {
    console.log(`[docker-safety] removed project=${project} and its named volumes`);
  }
}

process.exitCode = failed ? 1 : 0;
