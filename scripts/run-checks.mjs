import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmCommand = 'npm';
const nodeCommand = process.execPath;
const defaultTimeoutMs = Number(process.env.MEKSS_CHECK_TIMEOUT_MS || 15 * 60 * 1000);

const npmRun = (workspace, script) => ({
  command: npmCommand,
  args: ['--prefix', workspace, 'run', script],
  shell: process.platform === 'win32',
});

const command = (executable, args, options = {}) => ({ command: executable, args, ...options });
const gate = (name, invocation, options = {}) => ({ name, invocation, expected: 'success', ...options });

const gates = {
  'backend:lint': gate('backend lint (check-only)', npmRun('mekss-backend', 'lint:check')),
  'frontend:lint': gate('frontend lint (check-only)', npmRun('mekss-industrial-park', 'lint:check')),
  'backend:typecheck': gate('backend typecheck', npmRun('mekss-backend', 'typecheck')),
  'frontend:typecheck': gate('frontend typecheck', npmRun('mekss-industrial-park', 'typecheck')),
  'backend:build': gate('backend production build', npmRun('mekss-backend', 'build')),
  'frontend:build': gate('frontend production build', npmRun('mekss-industrial-park', 'build')),
  'backend:unit': gate('backend unit tests', npmRun('mekss-backend', 'test:unit')),
  'frontend:unit': gate('frontend unit tests', npmRun('mekss-industrial-park', 'test:unit')),
  'frontend:property:exploration': gate(
    'task-1 exploration property (fixed-system expectation)',
    npmRun('mekss-industrial-park', 'test:property:exploration'),
  ),
  'backend:property:preservation': gate(
    'task-2 preservation property',
    npmRun('mekss-backend', 'test:property:preservation'),
  ),
  'frontend:property:exploration-baseline': gate(
    'task-1 exploration property (unfixed baseline expects a counterexample)',
    npmRun('mekss-industrial-park', 'test:property:exploration'),
    { expected: 'failure' },
  ),
  'backend:integration': gate('backend isolated integration tests', npmRun('mekss-backend', 'test:integration')),
  'frontend:integration': gate('frontend integration tests', npmRun('mekss-industrial-park', 'test:integration')),
  'frontend:browser': gate('frontend Playwright browser tests', npmRun('mekss-industrial-park', 'test:browser'), { timeoutMs: 20 * 60 * 1000 }),
  'docker:config': gate(
    'Docker Compose configuration',
    command('docker', ['compose', '-f', 'mekss-backend/docker-compose.yml', 'config', '--quiet']),
  ),
  'docker:smoke': gate(
    'Docker disposable-stack smoke test',
    command(nodeCommand, ['scripts/docker-smoke.mjs']),
    { timeoutMs: 30 * 60 * 1000 },
  ),
};

const groups = {
  'lint:check': ['backend:lint', 'frontend:lint'],
  typecheck: ['backend:typecheck', 'frontend:typecheck'],
  build: ['backend:build', 'frontend:build'],
  'test:unit': ['backend:unit', 'frontend:unit'],
  'test:property': ['frontend:property:exploration', 'backend:property:preservation'],
  'test:property:baseline': ['frontend:property:exploration-baseline', 'backend:property:preservation'],
  'test:integration': ['backend:integration', 'frontend:integration'],
  'acceptance:baseline': [
    'backend:unit',
    'frontend:unit',
    'frontend:property:exploration-baseline',
    'backend:property:preservation',
    'docker:config',
  ],
  'acceptance:local': [
    'backend:lint',
    'frontend:lint',
    'backend:typecheck',
    'frontend:typecheck',
    'backend:build',
    'frontend:build',
    'backend:unit',
    'frontend:unit',
    'frontend:property:exploration',
    'backend:property:preservation',
    'backend:integration',
    'frontend:integration',
    'frontend:browser',
    'docker:smoke',
  ],
};

for (const key of Object.keys(gates)) groups[key] = [key];

function runGate({ name, invocation, expected, timeoutMs = defaultTimeoutMs }) {
  console.log(`\n[run] ${name}`);
  const startedAt = Date.now();

  return new Promise((resolvePromise) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        CI: process.env.CI || '1',
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        ...invocation.env,
      },
      shell: invocation.shell ?? false,
      stdio: 'inherit',
    });

    let settled = false;
    const finish = (actualExitCode, detail) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const matched = expected === 'failure' ? actualExitCode !== 0 : actualExitCode === 0;
      const durationMs = Date.now() - startedAt;
      const result = { name, matched, actualExitCode, expected, detail, durationMs };
      const label = matched ? 'passed' : 'failed';
      const expectation = expected === 'failure' ? 'expected non-zero' : 'expected zero';
      console[matched ? 'log' : 'error'](`[${label}] ${name}: ${detail}; ${expectation}; ${durationMs}ms`);
      resolvePromise(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(124, `timed out after ${timeoutMs}ms`);
    }, timeoutMs);

    child.on('error', (error) => finish(1, error.message));
    child.on('close', (code, signal) => {
      const exitCode = code ?? 1;
      finish(exitCode, signal ? `signal ${signal}` : `exit code ${exitCode}`);
    });
  });
}

const requested = process.argv[2];
if (requested === '--list') {
  console.log(Object.keys(groups).sort().join('\n'));
} else if (!requested || !groups[requested]) {
  console.error(`Usage: node scripts/run-checks.mjs <${Object.keys(groups).sort().join('|')}>`);
  process.exitCode = 2;
} else {
  const selected = groups[requested].map((key) => gates[key]);
  const results = [];
  for (const selectedGate of selected) results.push(await runGate(selectedGate));

  const failures = results.filter((result) => !result.matched);
  console.log('\nValidation summary');
  for (const result of results) {
    console.log(`- ${result.matched ? 'PASS' : 'FAIL'}: ${result.name} (${result.detail})`);
  }
  if (failures.length > 0) {
    console.error(`\nFailed gates (${failures.length}): ${failures.map(({ name }) => name).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${results.length} selected gates passed.`);
  }
}
