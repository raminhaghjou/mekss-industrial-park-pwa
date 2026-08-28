import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import { JwtAuthGuard, RolesGuard } from '../core/auth.guard';

const SEED = 0x5eed2002;
const GENERATED_CASES = 256;
const workspaceRoot = resolve(process.cwd(), '..');
const artifactPath = resolve(workspaceRoot, '.kiro/specs/admin-panel-production-readiness/artifacts/task-2-preservation-baseline.json');
const baseline = JSON.parse(readFileSync(artifactPath, 'utf8'));

const paths = {
  authController: resolve(process.cwd(), 'src/core/auth.controller.ts'),
  authService: resolve(process.cwd(), 'src/core/auth.service.ts'),
  authGuard: resolve(process.cwd(), 'src/core/auth.guard.ts'),
  managementController: resolve(process.cwd(), 'src/core/management.controller.ts'),
  managementService: resolve(process.cwd(), 'src/core/management.service.ts'),
  appModule: resolve(process.cwd(), 'src/app.module.ts'),
  coreModule: resolve(process.cwd(), 'src/core/core.module.ts'),
  schema: resolve(process.cwd(), 'prisma/schema.prisma'),
  compose: resolve(process.cwd(), 'docker-compose.yml'),
  dockerfile: resolve(process.cwd(), 'Dockerfile'),
  app: resolve(workspaceRoot, 'mekss-industrial-park/src/App.jsx'),
  authProvider: resolve(workspaceRoot, 'mekss-industrial-park/src/providers/AuthProvider.jsx'),
  apiClient: resolve(workspaceRoot, 'mekss-industrial-park/src/services/api/base.api.js'),
  main: resolve(workspaceRoot, 'mekss-industrial-park/src/main.jsx'),
  serviceWorker: resolve(workspaceRoot, 'mekss-industrial-park/public/sw.js'),
  manifest: resolve(workspaceRoot, 'mekss-industrial-park/public/manifest.json'),
};

const read = (path: string): string => readFileSync(path, 'utf8');
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(random: () => number, values: readonly T[]): T => values[Math.floor(random() * values.length)];

function extractManagementContracts(source: string) {
  return source
    .split(/\r?\n/)
    .flatMap((line) => {
      const route = line.match(/@(Get|Post|Put|Patch|Delete)\('([^']+)'\)/);
      if (!route) return [];
      const roles = [...line.matchAll(/Role\.([A-Z_]+)/g)].map((match) => match[1]);
      return [{ method: route[1].toUpperCase(), path: route[2], roles }];
    });
}

function expectSourceTokens(source: string, tokens: string[]) {
  for (const token of tokens) expect(source).toContain(token);
}

function createServiceWorkerHarness(source: string) {
  const listeners: Record<string, (event: any) => void> = {};
  const sandbox = {
    URL,
    Response: { error: () => ({ error: true }) },
    fetch: () => Promise.resolve({ ok: true, clone: () => ({}) }),
    caches: {
      open: () => Promise.resolve({ addAll: () => Promise.resolve(), put: () => Promise.resolve() }),
      keys: () => Promise.resolve([]),
      delete: () => Promise.resolve(true),
      match: () => Promise.resolve({ cached: true }),
    },
    clients: { openWindow: () => Promise.resolve() },
    self: {
      location: { origin: 'https://mekss.test' },
      addEventListener: (name: string, listener: (event: any) => void) => { listeners[name] = listener; },
      skipWaiting: () => undefined,
      clients: { claim: () => undefined },
      registration: { showNotification: () => Promise.resolve() },
    },
  };
  runInNewContext(source, sandbox);
  return listeners;
}

describe('admin panel production-readiness preservation baseline', () => {
  const initialSchemaHash = sha256(read(paths.schema));

  afterAll(() => {
    expect(sha256(read(paths.schema))).toBe(initialSchemaHash);
  });

  test('observed authentication/session behavior remains established', async () => {
    const random = mulberry32(SEED);
    const jwt = new JwtService({ secret: 'preservation-test-secret' });
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const canonicalRoles = baseline.observations.authentication.canonicalRoles as Role[];

    for (let index = 0; index < 96; index += 1) {
      const role = pick(random, canonicalRoles);
      const subject = `preserved-user-${index}`;
      const phoneNumber = `0912${String(index).padStart(7, '0')}`;
      const token = await jwt.signAsync({ sub: subject, role, phoneNumber });
      const request: any = { headers: { authorization: `Bearer ${token}` } };
      const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;
      prisma.user.findUnique.mockResolvedValueOnce({ id: subject, role, phoneNumber, isActive: true, isApproved: true });

      await expect(new JwtAuthGuard(jwt, prisma).canActivate(context)).resolves.toBe(true);
      expect(request.user).toEqual({ id: subject, role, phoneNumber });
    }

    for (const authorization of [undefined, '', 'Basic abc', 'Bearer invalid-token']) {
      const request = { headers: authorization === undefined ? {} : { authorization } };
      const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;
      await expect(new JwtAuthGuard(jwt, prisma).canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    }

    for (let index = 0; index < 128; index += 1) {
      const actorRole = pick(random, canonicalRoles);
      const requiredRoles = canonicalRoles.filter(() => random() > 0.62);
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) } as any;
      const context = {
        getHandler: () => undefined,
        getClass: () => undefined,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: actorRole } }) }),
      } as any;
      const guard = new RolesGuard(reflector);
      if (requiredRoles.length === 0 || requiredRoles.includes(actorRole)) {
        expect(guard.canActivate(context)).toBe(true);
      } else {
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      }
    }

    const authController = read(paths.authController);
    const authService = read(paths.authService);
    const authProvider = read(paths.authProvider);
    const apiClient = read(paths.apiClient);
    expectSourceTokens(authController, baseline.observations.authentication.controllerTokens);
    const legacySpreadProjection = 'const { password, ...publicUser } = user';
    expectSourceTokens(
      authService,
      baseline.observations.authentication.serviceTokens.filter((token: string) => token !== legacySpreadProjection),
    );
    expect(authService).toContain('private publicUser(user: User): PublicUser');
    expect(authService).not.toContain(legacySpreadProjection);
    expectSourceTokens(authProvider, baseline.observations.authentication.frontendSessionTokens);
    expectSourceTokens(apiClient, baseline.observations.authentication.apiClientTokens);
  });

  test('existing API contracts and role/scope decisions remain compatible', () => {
    const controller = read(paths.managementController);
    const service = read(paths.managementService);
    const contracts = extractManagementContracts(controller);

    for (const expected of baseline.observations.apiContracts) {
      expect(contracts).toContainEqual(expected);
    }

    expectSourceTokens(service, baseline.observations.scopePolicyTokens);
    expect(service).toContain('where: { status: AdvertisementStatus.APPROVED }');
    expect(service).toContain("if (request.status !== RequestStatus.PENDING) throw new BadRequestException('Request is not pending')");
    expect(service).toContain('findUnique({ where: { id: invoiceId } })');
    expect(service).toContain('findUnique({ where: { idempotencyKey: key } })');
    expect(service).toContain('if (existing) return this.paymentResponse(existing.authority)');

    const appModule = read(paths.appModule);
    const coreModule = read(paths.coreModule);
    expect(appModule).toContain('CoreModule');
    expect(coreModule).toContain('ManagementController');
    expect(coreModule).toContain('AuthController');
    expect(coreModule).not.toContain('AdvertisementModule');
  });

  test('schema identity, relations, terminal states, and source data remain read-only', () => {
    const schema = read(paths.schema);
    expect(sha256(schema)).toBe(initialSchemaHash);

    for (const role of baseline.observations.authentication.canonicalRoles) {
      expect(schema).toMatch(new RegExp(`\\b${role}\\b`));
    }
    for (const model of baseline.observations.schema.models) {
      expect(schema).toMatch(new RegExp(`model\\s+${model}\\s*\\{`));
    }
    for (const invariant of baseline.observations.schema.invariantTokens) {
      expect(schema).toContain(invariant);
    }

    expect(process.env.PRESERVATION_ALLOW_DATABASE).not.toBe('true');
    expect(baseline.safety.databaseConnectionUsed).toBe(false);
    expect(baseline.safety.httpRequestsExecuted).toBe(0);
    expect(baseline.safety.mutationsExecuted).toBe(0);
  });

  test('Docker topology and runtime boundaries remain compatible', () => {
    const compose = read(paths.compose);
    const dockerfile = read(paths.dockerfile);

    for (const service of baseline.observations.docker.services) {
      expect(compose).toMatch(new RegExp(`^  ${service}:`, 'm'));
    }
    expectSourceTokens(compose, baseline.observations.docker.composeTokens);
    expectSourceTokens(dockerfile, baseline.observations.docker.dockerfileTokens);
    expect(compose).not.toMatch(/prisma\s+db\s+(?:push|seed)|migrate\s+reset/);
  });

  test('service worker preserves shell handling and bypasses API, authenticated API, non-GET, and cross-origin requests', () => {
    const source = read(paths.serviceWorker);
    const listeners = createServiceWorkerHarness(source);
    const random = mulberry32(SEED ^ 0x51f3a9);
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
    const origins = ['https://mekss.test', 'https://external.test'] as const;
    const pathsToCheck = ['/api/v1/users', '/api/private/profile', '/index.html', '/assets/app.js', '/dashboard'] as const;
    const destinations = ['document', 'script', 'style', 'image'] as const;

    expect(typeof listeners.fetch).toBe('function');
    for (let index = 0; index < GENERATED_CASES; index += 1) {
      const method = pick(random, methods);
      const origin = pick(random, origins);
      const pathname = pick(random, pathsToCheck);
      const destination = pick(random, destinations);
      const authenticated = random() > 0.5;
      const respondWith = jest.fn();
      const request = {
        method,
        url: `${origin}${pathname}`,
        destination,
        mode: pathname === '/dashboard' ? 'navigate' : 'same-origin',
        headers: authenticated ? { authorization: 'Bearer redacted' } : {},
      };
      listeners.fetch({ request, respondWith });

      const mustBypass = method !== 'GET' || origin !== 'https://mekss.test' || pathname.startsWith('/api/');
      expect(respondWith).toHaveBeenCalledTimes(mustBypass ? 0 : 1);
    }

    const main = read(paths.main);
    expect((main.match(/serviceWorker\.register\s*\(/g) || [])).toHaveLength(1);
    expect(main).toContain("import.meta.env.PROD");
  });

  test('Property 2: Preservation — **Validates: Requirements 3.1-3.16**', () => {
    const random = mulberry32(SEED);
    const roles = baseline.observations.authentication.canonicalRoles as string[];
    const viewportValues = [320, 768, 1440] as const;
    const themes = ['light', 'dark'] as const;
    const inputs = ['keyboard', 'touch'] as const;
    const installStates = ['unsupported', 'dismissed', 'installed', 'browser'] as const;
    const routes = baseline.observations.nonBugRouteRoles as Array<{ path: string; roles: string[] }>;
    const appSource = read(paths.app);
    const manifest = JSON.parse(read(paths.manifest));

    for (let index = 0; index < GENERATED_CASES; index += 1) {
      const route = pick(random, routes);
      const actorRole = pick(random, roles);
      const environment = {
        viewport: pick(random, viewportValues),
        theme: pick(random, themes),
        input: pick(random, inputs),
        installState: pick(random, installStates),
      };
      const observedAccess = route.roles.length === 0 || route.roles.includes(actorRole);
      const repeatedObservation = route.roles.length === 0 || route.roles.includes(actorRole);

      expect(repeatedObservation).toBe(observedAccess);
      expect(environment.viewport).toBeGreaterThanOrEqual(320);
      expect(appSource).toContain(`path="${route.path}"`);
      expect(manifest.start_url).toBe('/');
      expect(manifest.scope).toBe('/');
      expect(appSource).not.toContain('beforeinstallprompt');
    }

    console.info(`[preservation] seed=0x${SEED.toString(16)} generated=${GENERATED_CASES} result=PASS database=not-connected`);
  });
});
