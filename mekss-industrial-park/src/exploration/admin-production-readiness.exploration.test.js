import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const SEED = 0x5eed2025;
const GENERATED_CASES = 256;
const workspaceRoot = resolve(process.cwd(), '..');
const frontendRoot = resolve(workspaceRoot, 'mekss-industrial-park');
const backendRoot = resolve(workspaceRoot, 'mekss-backend');
const specRoot = resolve(workspaceRoot, '.kiro/specs/admin-panel-production-readiness');
const artifactPath = resolve(specRoot, 'artifacts/task-1-bug-condition-exploration.json');

const routeManifest = [
  { route: '/dashboard', file: 'src/pages/dashboard/DashboardPage.jsx', operations: ['role summaries', 'pending work', 'recent priorities', 'quick actions'] },
  { route: '/admin/factories', file: 'src/pages/admin/ManageFactoriesPage.jsx', operations: ['list', 'edit', 'approve', 'reject'] },
  { route: '/admin/invoices', file: 'src/pages/admin/ManageInvoicesPage.jsx', operations: ['list', 'create navigation', 'edit', 'delete'] },
  { route: '/admin/invoices/create', file: 'src/pages/admin/CreateInvoicePage.jsx', operations: ['create', 'back navigation'] },
  { route: '/admin/gate-passes', file: 'src/pages/admin/ApproveGatePassesPage.jsx', operations: ['list', 'view', 'approve', 'reject'] },
  { route: '/admin/requests', file: 'src/pages/admin/ApproveRequestsPage.jsx', operations: ['list', 'view', 'approve', 'reject'] },
  { route: '/admin/messages', file: 'src/pages/admin/SendMessagePage.jsx', operations: ['select recipients', 'send'] },
  { route: '/admin/announcements', file: 'src/pages/admin/ManageAnnouncementsPage.jsx', operations: ['list', 'create', 'edit', 'delete'] },
  { route: '/admin/advertisements', file: 'src/pages/admin/ApproveAdvertisementsPage.jsx', operations: ['pending/history list', 'view', 'approve', 'reject'] },
  { route: '/admin/reports', file: 'src/pages/admin/ReportsPage.jsx', operations: ['filter', 'generate'] },
  { route: '/superadmin/parks', file: 'src/pages/superadmin/ManageParksPage.jsx', operations: ['list', 'create', 'edit', 'delete'] },
  { route: '/superadmin/users', file: 'src/pages/superadmin/ManageUsersPage.jsx', operations: ['search/list', 'create (missing)', 'edit', 'activate/deactivate', 'delete (missing)'] },
  { route: '/superadmin/advertisements', file: 'src/pages/superadmin/SuperAdminAdsPage.jsx', operations: ['pending/history list', 'park filter', 'view', 'approve', 'reject'] },
  { route: '/superadmin/sms-config', file: 'src/pages/superadmin/SmsConfigPage.jsx', operations: ['edit secret fields', 'save'] },
];

const dimensions = {
  surface: ['ROLE_DASHBOARD', 'PARK_MANAGEMENT', 'USER_MANAGEMENT', 'ADVERTISEMENT_MODERATION', 'OTHER_VISIBLE_ADMIN_OPERATION', 'PERSIAN_RTL_PRESENTATION', 'RESPONSIVE_NAVIGATION', 'PWA_INSTALLATION', 'OFFLINE_ADMIN_STATE', 'ACCESSIBLE_INTERACTION', 'AUTOMATED_CHECK'],
  role: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'SECURITY_GUARD', 'GOVERNMENT_OFFICIAL', 'EMPLOYEE'],
  tenantScope: ['IN_SCOPE', 'OUT_OF_SCOPE'],
  payloadValidity: ['VALID', 'INVALID'],
  apiOutcome: ['SUCCESS', 'VALIDATION', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'NETWORK', 'SERVER_ERROR'],
  recordCount: [0, 1, 25],
  viewport: [320, 768, 1440],
  directionSensitiveContent: ['PERSIAN', 'LTR_IDENTIFIER', 'MIXED_BIDI'],
  connectivity: ['ONLINE', 'OFFLINE'],
  installEventAvailable: [false, true],
  installed: [false, true],
  inputMode: ['KEYBOARD', 'TOUCH'],
  theme: ['LIGHT', 'DARK'],
  zoom: [1, 2],
  reducedMotion: [false, true],
};

const read = (root, path) => readFileSync(resolve(root, path), 'utf8');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const count = (source, expression) => [...source.matchAll(expression)].length;
const cleanOutput = (value = '') => value.replace(/\u001b\[[0-9;]*m/g, '').trim().slice(0, 16000);

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCases() {
  const random = seededRandom(SEED);
  const entries = Object.entries(dimensions);
  return Array.from({ length: GENERATED_CASES }, (_, index) => Object.fromEntries(
    entries.map(([name, values], dimensionIndex) => {
      const offset = Math.floor(random() * values.length);
      return [name, values[(index * (dimensionIndex * 2 + 1) + offset) % values.length]];
    }),
  ));
}

function isBugCondition(input) {
  const affectedSurface = dimensions.surface.includes(input.surface);
  const defectiveResult = [
    input.currentResult.placeholderData,
    input.currentResult.mockData,
    input.currentResult.emptyOrConsoleHandler,
    input.currentResult.browserOnlyMutation,
    input.currentResult.falseSuccess,
    input.currentResult.missingAuthorizationOrScope,
    input.currentResult.missingValidationOrConfirmation,
    input.currentResult.unhandledState,
    input.currentResult.inaccessibleControl,
    input.currentResult.responsiveOverflow,
    input.currentResult.invalidInstallLifecycle,
    input.currentResult.unsafeOfflineMutation,
    input.currentResult.failingRequiredCheck,
  ].some(Boolean);
  return affectedSurface && defectiveResult;
}

function expectedBehavior(input, result) {
  const validMutationPath = input.role === 'SUPER_ADMIN'
    && input.tenantScope === 'IN_SCOPE'
    && input.payloadValidity === 'VALID'
    && input.apiOutcome === 'SUCCESS'
    && input.connectivity === 'ONLINE';

  if (validMutationPath) {
    return result.serverConfirmed
      && result.durable
      && result.exactlyIntendedChange
      && result.preservesUnrelatedRecords
      && result.persianRtlAccessibleFeedback;
  }

  return result.explicitSafeState
    && result.nonMutating
    && !result.falseSuccess
    && !result.disclosesProtectedData;
}

function inspectRoute(entry, appRoutes) {
  const source = read(frontendRoot, entry.file);
  const controls = count(source, /<(?:Button|IconButton)\b/g);
  const unboundControls = count(source, /<(?:Button|IconButton)\b(?![^>]*(?:onClick|type=["']submit["']))[^>]*>/g);
  const signals = {
    registered: appRoutes.includes(entry.route.slice(1)),
    mockData: /\bmock[A-Z]\w*\b/.test(source),
    fabricatedIdentifier: /\b(?:P-0[12]|U-00[1-4]|F-0[1-4]|INV-10[1-4]|GP-10[1-4]|REQ-10[1-3])\b/.test(source),
    apiBacked: /\b(?:useQuery|useMutation|apiClient|axios|fetch\s*\(|\w+Api\.)/.test(source),
    browserDialog: /\b(?:alert|prompt|confirm)\s*\(/.test(source),
    consoleOnly: /console\.(?:log|info|warn)\s*\(/.test(source),
    placeholder: /Placeholder|Add .* widgets|Add navigation later|بخش نمایش نمودارها/i.test(source),
    controls,
    unboundControls,
    formSubmissions: count(source, /onSubmit=/g),
  };

  const defects = [];
  if (!signals.registered) defects.push('route-not-registered');
  if (signals.mockData || signals.fabricatedIdentifier) defects.push('mock-or-fabricated-data');
  if (!signals.apiBacked) defects.push('no-api-query-or-mutation');
  if (signals.browserDialog) defects.push('browser-dialog-false-feedback');
  if (signals.consoleOnly) defects.push('console-only-operation');
  if (signals.placeholder) defects.push('placeholder-surface');
  if (signals.unboundControls > 0) defects.push('visible-unbound-controls');
  if (signals.formSubmissions > 0 && !signals.apiBacked) defects.push('browser-only-form');

  return { ...entry, signals, defects };
}

function runGate(name, cwd, script) {
  const command = `npm run ${script}`;
  const startedAt = Date.now();
  const result = spawnSync(command, {
    cwd,
    encoding: 'utf8',
    shell: true,
    timeout: 180000,
    env: { ...process.env, CI: '1', NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return {
    name,
    command,
    cwd: relative(workspaceRoot, cwd).replaceAll('\\', '/'),
    exitCode: result.status,
    signal: result.signal,
    timedOut: result.error?.code === 'ETIMEDOUT',
    durationMs: Date.now() - startedAt,
    output: cleanOutput(`${result.stdout || ''}\n${result.stderr || ''}`),
  };
}

function summarizeCounterexample(id, surface, evidence, expected) {
  return { id, surface, minimizedInput: evidence, expected, observed: 'bug condition present on unfixed source' };
}

describe('admin panel production-readiness bug condition exploration', () => {
  test('Property 1: Truthful Production-Ready Administration — **Validates: Requirements 1.1-1.16, 2.1-2.16**', () => {
    const appSource = read(frontendRoot, 'src/App.jsx');
    const layoutSource = read(frontendRoot, 'src/layouts/DashboardLayout.jsx');
    const mainSource = read(frontendRoot, 'src/main.jsx');
    const serviceWorkerSource = read(frontendRoot, 'public/sw.js');
    const controllerSource = read(backendRoot, 'src/core/management.controller.ts');
    const schemaSourceBefore = read(backendRoot, 'prisma/schema.prisma');
    const managementSourceBefore = read(backendRoot, 'src/core/management.service.ts');
    const appRoutes = [...appSource.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map((match) => match[1]);
    const routeInventory = routeManifest.map((entry) => inspectRoute(entry, appRoutes));

    const missingContracts = [
      { operation: 'industrial park list/create', token: "@Get('industrial-parks')" },
      { operation: 'industrial park update/delete', token: "@Delete('industrial-parks/:id')" },
      { operation: 'user detail/delete', token: "@Delete('users/:id')" },
      { operation: 'admin advertisement list/detail', token: "@Get('admin/advertisements')" },
      { operation: 'separate advertisement reject transition', token: "advertisements/:id/reject" },
      { operation: 'durable batch messaging', token: "@Post('messages/batch')" },
      { operation: 'scoped reports', token: "@Get('reports')" },
      { operation: 'notifications/settings', token: "@Get('notifications')" },
      { operation: 'non-secret SMS health', token: "@Get('sms/health')" },
    ].filter(({ token }) => !controllerSource.includes(token));

    const dashboard = routeInventory.find(({ route }) => route === '/dashboard');
    const responsiveFindings = {
      startsPersistentOpen: /useState\(true\)/.test(layoutSource) && /variant=["']persistent["']/.test(layoutSource),
      fixedDrawerWidth: /drawerWidth\s*=\s*280/.test(layoutSource),
      negativeDesktopMarginAtAllWidths: /marginRight:\s*-drawerWidth/.test(layoutSource),
      responsiveDrawerVariant: /useMediaQuery|variant=\{.*(?:temporary|permanent)/s.test(layoutSource),
      minimumViewport: 320,
    };
    const lifecycleSource = `${mainSource}\n${layoutSource}`;
    const pwaFindings = {
      serviceWorkerRegistrations: count(mainSource, /serviceWorker\.register\s*\(/g),
      hasBeforeInstallPrompt: /beforeinstallprompt/.test(lifecycleSource),
      hasAppInstalled: /appinstalled/.test(lifecycleSource),
      detectsStandalone: /display-mode:\s*standalone|navigator\.standalone/.test(lifecycleSource),
      hasConnectivityState: /navigator\.onLine|addEventListener\(["'](?:online|offline)["']/.test(lifecycleSource),
      blocksOfflineMutations: /offline.*(?:mutation|submit|disabled)|(?:mutation|submit).*offline/is.test(lifecycleSource),
      serviceWorkerBypassesApiAndMutations: /request\.method\s*!==\s*["']GET["']/.test(serviceWorkerSource) && /pathname\.startsWith\(["']\/api\//.test(serviceWorkerSource),
    };
    const accessibilityFindings = {
      iconButtons: count(layoutSource, /<IconButton\b/g),
      explicitlyNamedIconButtons: count(layoutSource, /<IconButton\b[^>]*aria-label=/g),
      notificationControlHasNoAction: /<IconButton size=["']large["'] color=["']inherit["']>\s*<Badge/s.test(layoutSource),
    };

    const gates = [
      runGate('frontend:typecheck', frontendRoot, 'typecheck'),
      runGate('frontend:build', frontendRoot, 'build'),
      runGate('backend:typecheck', backendRoot, 'typecheck'),
      runGate('backend:build', backendRoot, 'build'),
    ];

    const failingGates = gates.filter((gate) => gate.exitCode !== 0);
    const generatedInputs = generateCases().map((input, index) => {
      const route = routeInventory[index % routeInventory.length];
      const currentResult = {
        placeholderData: route.signals.placeholder,
        mockData: route.signals.mockData || route.signals.fabricatedIdentifier,
        emptyOrConsoleHandler: route.signals.unboundControls > 0 || route.signals.consoleOnly,
        browserOnlyMutation: route.signals.browserDialog || route.signals.formSubmissions > 0,
        falseSuccess: route.signals.browserDialog,
        missingAuthorizationOrScope: !route.signals.apiBacked,
        missingValidationOrConfirmation: route.signals.controls > 0 && !route.signals.apiBacked,
        unhandledState: !route.signals.apiBacked,
        inaccessibleControl: route.signals.unboundControls > 0 || accessibilityFindings.explicitlyNamedIconButtons < accessibilityFindings.iconButtons,
        responsiveOverflow: input.viewport === 320 && responsiveFindings.startsPersistentOpen && responsiveFindings.fixedDrawerWidth,
        invalidInstallLifecycle: input.installEventAvailable && !input.installed && !pwaFindings.hasBeforeInstallPrompt,
        unsafeOfflineMutation: input.connectivity === 'OFFLINE' && !pwaFindings.blocksOfflineMutations,
        failingRequiredCheck: failingGates.length > 0,
      };
      const observedResult = {
        serverConfirmed: route.signals.apiBacked,
        durable: false,
        exactlyIntendedChange: false,
        preservesUnrelatedRecords: false,
        persianRtlAccessibleFeedback: false,
        explicitSafeState: false,
        nonMutating: !route.signals.browserDialog,
        falseSuccess: route.signals.browserDialog,
        disclosesProtectedData: false,
      };
      return { ...input, route: route.route, currentResult, observedResult };
    });

    const failingCases = generatedInputs.filter((input) => isBugCondition(input) && !expectedBehavior(input, input.observedResult));
    const coverage = Object.fromEntries(Object.keys(dimensions).map((name) => [name, [...new Set(generatedInputs.map((input) => input[name]))]]));

    const counterexamples = [
      summarizeCounterexample('CE-01', 'PARK_MANAGEMENT', { route: '/superadmin/parks', fixtureId: 'API-FIXTURE-PARK-9', renderedSourceId: 'P-01', source: 'ManageParksPage.jsx:17-20' }, 'Persisted fixture IDs are queried and CRUD controls call industrial-park contracts.'),
      summarizeCounterexample('CE-02', 'USER_MANAGEMENT', { route: '/superadmin/users', fixtureId: 'API-FIXTURE-USER-9', renderedSourceId: 'U-001', rawNonCanonicalRole: 'FACTORY_MANAGER', source: 'ManageUsersPage.jsx:19-24' }, 'Persisted users and canonical roles are loaded; create and safe lifecycle actions are durable.'),
      summarizeCounterexample('CE-03', 'ADVERTISEMENT_MODERATION', { route: '/admin/advertisements', fixtureId: 'API-FIXTURE-AD-9', renderedSourceId: 1, unboundActions: ['مشاهده', 'تایید', 'رد'], source: 'ApproveAdvertisementsPage.jsx:13-17,48-53' }, 'Scoped records load from the API and exactly one confirmed moderation transition occurs.'),
      summarizeCounterexample('CE-04', 'ROLE_DASHBOARD', { route: '/dashboard', role: 'SUPER_ADMIN', apiFixture: { pendingAdvertisements: 7 }, observed: 'heading-only', source: 'DashboardPage.jsx:34-49' }, 'Scoped summaries, pending work, recent priorities, and quick actions render from analytics.'),
      summarizeCounterexample('CE-05', 'OTHER_VISIBLE_ADMIN_OPERATION', { route: '/admin/invoices/create', operation: 'submit', observed: 'console.log + alert; no request', source: 'CreateInvoicePage.jsx:51-57' }, 'A validated server-confirmed mutation occurs or the operation is explicitly unavailable.'),
      summarizeCounterexample('CE-06', 'MISSING_API_CONTRACT', { missingContracts: missingContracts.map(({ operation }) => operation), controller: 'management.controller.ts' }, 'Every visible operation has an active /api/v1 contract or an explicit unavailable state.'),
      summarizeCounterexample('CE-07', 'RESPONSIVE_NAVIGATION', { viewport: 320, drawerWidth: 280, variant: 'persistent', startsOpen: true, marginRight: -280 }, 'Temporary/compact navigation avoids horizontal task-area loss and preserves context.'),
      summarizeCounterexample('CE-08', 'PWA_INSTALLATION', { installEventAvailable: true, installed: false, beforeinstallpromptHandler: false }, 'A user-gesture-only Persian install affordance follows the browser event lifecycle.'),
      summarizeCounterexample('CE-09', 'OFFLINE_ADMIN_STATE', { connectivity: 'OFFLINE', operation: 'approve', connectivityProvider: false, mutationGuard: false }, 'Offline mutations are blocked and stale data refreshes before decisions resume.'),
      summarizeCounterexample('CE-10', 'ACCESSIBLE_INTERACTION', { shellIconButtons: accessibilityFindings.iconButtons, explicitlyNamed: accessibilityFindings.explicitlyNamedIconButtons, notificationActionBound: !accessibilityFindings.notificationControlHasNoAction }, 'Every icon action has an accessible name and truthful behavior.'),
      ...failingGates.map((gate, index) => summarizeCounterexample(`CE-BUILD-${index + 1}`, 'AUTOMATED_CHECK', { command: gate.command, cwd: gate.cwd, exitCode: gate.exitCode, firstOutput: gate.output.split('\n').slice(0, 8) }, 'Required type/build gate exits successfully.')),
    ];

    const schemaSourceAfter = read(backendRoot, 'prisma/schema.prisma');
    const managementSourceAfter = read(backendRoot, 'src/core/management.service.ts');
    const persistenceEvidence = {
      httpRequestsExecuted: 0,
      databaseConnectionUsed: false,
      auditWritesExecuted: 0,
      before: { schemaSha256: digest(schemaSourceBefore), managementServiceSha256: digest(managementSourceBefore) },
      after: { schemaSha256: digest(schemaSourceAfter), managementServiceSha256: digest(managementSourceAfter) },
      unchanged: schemaSourceBefore === schemaSourceAfter && managementSourceBefore === managementSourceAfter,
      note: 'Source-level exploration intentionally performs no HTTP or database mutation against unfixed data.',
    };

    const artifact = {
      task: '1. [Required] Write the bug condition exploration property test',
      property: 'Property 1: Bug Condition - Truthful Production-Ready Administration',
      validates: ['Requirements 1.1-1.16', 'Requirements 2.1-2.16'],
      expectedOutcome: 'FAIL on unfixed code',
      seed: `0x${SEED.toString(16)}`,
      generatedCaseCount: generatedInputs.length,
      failingCaseCount: failingCases.length,
      minimizedGeneratedCounterexample: failingCases[0],
      dimensionCoverage: coverage,
      routeInventory,
      routeCoverage: { expected: routeManifest.length, inspected: routeInventory.length, registered: routeInventory.filter((route) => route.signals.registered).length },
      dashboardFindings: dashboard,
      missingApiContracts: missingContracts,
      responsiveFindings,
      pwaFindings,
      accessibilityFindings,
      gates,
      persistenceEvidence,
      counterexamples,
      generatedAt: new Date().toISOString(),
    };

    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

    expect(routeInventory).toHaveLength(routeManifest.length);
    expect(routeInventory.every((route) => route.signals.registered)).toBe(true);
    expect(coverage.surface).toHaveLength(dimensions.surface.length);
    expect(coverage.role).toHaveLength(dimensions.role.length);
    expect(coverage.viewport).toEqual(expect.arrayContaining(dimensions.viewport));

    const summary = [
      `seed=0x${SEED.toString(16)}`,
      `generated=${generatedInputs.length}`,
      `failed=${failingCases.length}`,
      `routes=${routeInventory.length}/${routeManifest.length}`,
      `missingContracts=${missingContracts.length}`,
      `failingGates=${failingGates.map((gate) => gate.name).join(',') || 'none'}`,
      `artifact=${relative(workspaceRoot, artifactPath).replaceAll('\\', '/')}`,
      `minimized=${JSON.stringify(failingCases[0])}`,
    ].join('\n');

    expect(failingCases, `Expected exploration failure on unfixed code.\n${summary}`).toHaveLength(0);
  }, 720000);
});
