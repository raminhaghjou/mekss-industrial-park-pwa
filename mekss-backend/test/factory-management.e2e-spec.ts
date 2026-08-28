import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { FactoryStatus, ParkStatus, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma.service';
import { requestContextMiddleware } from '../src/core/request-context';

const createTestApp = async (): Promise<INestApplication> => {
  const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();
  app.use(requestContextMiddleware);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
};

const parkData = (id: string, code: string, status: ParkStatus = ParkStatus.ACTIVE) => ({
  id,
  code,
  name: `${code} industrial park`,
  province: 'Tehran',
  city: 'Tehran',
  address: `${code} address`,
  phoneNumber: '02166550000',
  guardPhone: '02166550001',
  status,
});

type SeedActor = { id: string; token: string };

describe('Scoped conflict-safe factory management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let admin: SeedActor;
  let managerA: SeedActor;
  let managerB: SeedActor;
  let ownerA: SeedActor;
  let ownerB: SeedActor;
  let ownerFree: SeedActor;
  let inactiveOwner: SeedActor;
  let unapprovedOwner: SeedActor;
  let guard: SeedActor;
  let official: SeedActor;
  let employee: SeedActor;

  const adminPassword = 'FactoryContract123';
  const parkAId = 'factory-contract-park-a';
  const parkBId = 'factory-contract-park-b';
  const inactiveParkId = 'factory-contract-park-inactive';
  const actorIds: string[] = [];
  let nextFactoryNationalId = 1700000000;
  const auth = (actor: SeedActor) => ({ Authorization: `Bearer ${actor.token}` });

  const issueCurrentToken = async (userId: string) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
    return jwt.signAsync({ sub: userId, sessionVersion: user.sessionVersion });
  };

  const createActor = async (
    id: string,
    phoneNumber: string,
    role: Role,
    options: { active?: boolean; approved?: boolean; password?: string } = {},
  ): Promise<SeedActor> => {
    actorIds.push(id);
    await prisma.user.create({
      data: {
        id,
        phoneNumber,
        password: options.password ?? 'not-used',
        name: id,
        email: `${id}@example.test`,
        role,
        isActive: options.active ?? true,
        isApproved: options.approved ?? true,
      },
    });
    return { id, token: await issueCurrentToken(id) };
  };

  const createFactory = async (
    id: string,
    parkId: string,
    managerId: string,
    overrides: Partial<Prisma.FactoryUncheckedCreateInput> = {},
  ) => prisma.factory.create({
    data: {
      id,
      name: `Factory ${id}`,
      licenseNumber: `LIC-${id}`,
      nationalId: String(nextFactoryNationalId++),
      activityType: 'Manufacturing',
      address: 'Factory contract address',
      phoneNumber: '09126660000',
      parkId,
      managerId,
      status: FactoryStatus.PENDING,
      isApproved: false,
      ...overrides,
    } as Prisma.FactoryUncheckedCreateInput,
  });

  const payload = (suffix: string, overrides: Record<string, unknown> = {}) => ({
    name: ` Factory ${suffix} `,
    licenseNumber: ` LIC-${suffix} `,
    nationalId: `18${suffix.replace(/\D/g, '').padEnd(8, '0').slice(0, 8)}`,
    activityType: ' Advanced manufacturing ',
    address: ' Durable factory address ',
    phoneNumber: ' 09126661111 ',
    parkId: parkAId,
    managerId: ownerA.id,
    ...overrides,
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const adminHash = await bcrypt.hash(adminPassword, 4);

    [admin, managerA, managerB, ownerA, ownerB, ownerFree, inactiveOwner, unapprovedOwner, guard, official, employee] = await Promise.all([
      createActor('factory-contract-admin', '09126660001', Role.SUPER_ADMIN, { password: adminHash }),
      createActor('factory-contract-manager-a', '09126660002', Role.PARK_MANAGER),
      createActor('factory-contract-manager-b', '09126660003', Role.PARK_MANAGER),
      createActor('factory-contract-owner-a', '09126660004', Role.FACTORY_OWNER),
      createActor('factory-contract-owner-b', '09126660005', Role.FACTORY_OWNER),
      createActor('factory-contract-owner-free', '09126660006', Role.FACTORY_OWNER),
      createActor('factory-contract-owner-inactive', '09126660007', Role.FACTORY_OWNER, { active: false }),
      createActor('factory-contract-owner-unapproved', '09126660008', Role.FACTORY_OWNER, { approved: false }),
      createActor('factory-contract-guard', '09126660009', Role.SECURITY_GUARD),
      createActor('factory-contract-official', '09126660010', Role.GOVERNMENT_OFFICIAL),
      createActor('factory-contract-employee', '09126660011', Role.EMPLOYEE),
    ]);

    await prisma.industrialPark.createMany({
      data: [
        parkData(parkAId, 'FACTORY-CONTRACT-A'),
        parkData(parkBId, 'FACTORY-CONTRACT-B'),
        parkData(inactiveParkId, 'FACTORY-CONTRACT-INACTIVE', ParkStatus.INACTIVE),
      ],
    });
    await Promise.all([
      prisma.industrialPark.update({ where: { id: parkAId }, data: { managers: { connect: { id: managerA.id } } } }),
      prisma.industrialPark.update({ where: { id: parkBId }, data: { managers: { connect: { id: managerB.id } } } }),
      prisma.securityGuard.create({
        data: {
          userId: guard.id,
          parkId: parkAId,
          shiftStart: new Date('2026-08-28T06:00:00.000Z'),
          shiftEnd: new Date('2026-08-28T14:00:00.000Z'),
        },
      }),
    ]);
    await Promise.all([
      createFactory('factory-contract-seed-a', parkAId, ownerA.id),
      createFactory('factory-contract-seed-b', parkBId, ownerB.id, { status: FactoryStatus.ACTIVE, isApproved: true }),
    ]);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "test_fail_factory_audit" ON "AuditLog"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "test_fail_factory_audit_fn"()');
      await prisma.securityGuard.deleteMany({ where: { userId: { in: actorIds } } });
      await prisma.factory.deleteMany({ where: { parkId: { in: [parkAId, parkBId, inactiveParkId] } } });
      await prisma.industrialPark.deleteMany({ where: { id: { in: [parkAId, parkBId, inactiveParkId] } } });
    }
    if (app) await app.close();
    // The integration runner owns and drops the isolated mekss_test_* schema, including immutable audits and actors.
  });

  it('preserves the legacy raw array and enforces role-derived list, detail, and non-disclosing scope', async () => {
    const adminLegacy = await request(app.getHttpServer()).get('/api/v1/factories').set(auth(admin));
    expect(adminLegacy.status).toBe(200);
    expect(Array.isArray(adminLegacy.body)).toBe(true);
    expect(adminLegacy.body.map(({ id }: { id: string }) => id)).toEqual(
      expect.arrayContaining(['factory-contract-seed-a', 'factory-contract-seed-b']),
    );

    const managerLegacy = await request(app.getHttpServer()).get('/api/v1/factories').set(auth(managerA));
    expect(managerLegacy.status).toBe(200);
    expect(managerLegacy.body.map(({ id }: { id: string }) => id)).toEqual(['factory-contract-seed-a']);
    expect(managerLegacy.body[0]).toMatchObject({
      park: { id: parkAId, code: 'FACTORY-CONTRACT-A' },
      manager: { id: ownerA.id, phoneNumber: '09126660004' },
    });

    const ownerLegacy = await request(app.getHttpServer()).get('/api/v1/factories').set(auth(ownerA));
    const guardLegacy = await request(app.getHttpServer()).get('/api/v1/factories').set(auth(guard));
    const officialLegacy = await request(app.getHttpServer()).get('/api/v1/factories').set(auth(official));
    expect(ownerLegacy.body.map(({ id }: { id: string }) => id)).toEqual(['factory-contract-seed-a']);
    expect(guardLegacy.body.map(({ id }: { id: string }) => id)).toEqual(['factory-contract-seed-a']);
    expect(officialLegacy.body.some(({ id }: { id: string }) => id === 'factory-contract-seed-b')).toBe(true);

    const page = await request(app.getHttpServer()).get('/api/v1/factories/managed?page=1&pageSize=20').set(auth(managerA));
    expect(page.status).toBe(200);
    expect(page.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(page.body.items[0]).toMatchObject({
      id: 'factory-contract-seed-a', status: FactoryStatus.PENDING, isApproved: false,
      park: { id: parkAId }, manager: { id: ownerA.id }, reviewedBy: null,
    });
    const detail = await request(app.getHttpServer()).get('/api/v1/factories/managed/factory-contract-seed-a').set(auth(managerA));
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject(page.body.items[0]);

    for (const actor of [ownerA, guard, official, employee]) {
      expect((await request(app.getHttpServer()).get('/api/v1/factories/managed').set(auth(actor))).status).toBe(403);
    }
    expect((await request(app.getHttpServer()).get('/api/v1/factories').set(auth(employee))).status).toBe(403);
    expect((await request(app.getHttpServer()).get('/api/v1/factories')).status).toBe(401);

    for (const [index, actor] of [ownerA, guard, official, employee].entries()) {
      const deniedCreate = await request(app.getHttpServer()).post('/api/v1/factories').set(auth(actor))
        .send(payload(`AUTH-${index}`));
      expect(deniedCreate.status).toBe(403);
    }
    for (const actor of [guard, official, employee]) {
      expect((await request(app.getHttpServer()).put('/api/v1/factories/factory-contract-seed-a')
        .set(auth(actor)).send({ name: 'Forbidden profile edit' })).status).toBe(403);
    }
    for (const actor of [ownerA, guard, official, employee]) {
      expect((await request(app.getHttpServer()).post('/api/v1/factories/factory-contract-seed-a/approve')
        .set(auth(actor))).status).toBe(403);
      expect((await request(app.getHttpServer()).post('/api/v1/factories/factory-contract-seed-a/reject')
        .set(auth(actor)).send({ reason: 'Forbidden decision' })).status).toBe(403);
    }
    await expect(prisma.factory.findUniqueOrThrow({ where: { id: 'factory-contract-seed-a' }, select: {
      name: true, status: true, isApproved: true, reviewedAt: true, reviewedById: true,
    } })).resolves.toEqual({
      name: 'Factory factory-contract-seed-a', status: FactoryStatus.PENDING,
      isApproved: false, reviewedAt: null, reviewedById: null,
    });
    await expect(prisma.factory.count({ where: { licenseNumber: { startsWith: 'LIC-AUTH-' } } })).resolves.toBe(0);
    await expect(prisma.auditLog.count({ where: { entity: 'Factory', entityId: 'factory-contract-seed-a' } })).resolves.toBe(0);

    for (const id of ['factory-contract-seed-b', 'factory-contract-missing']) {
      expect((await request(app.getHttpServer()).get(`/api/v1/factories/managed/${id}`).set(auth(managerA))).status).toBe(403);
    }
    expect((await request(app.getHttpServer()).get('/api/v1/factories/managed/factory-contract-missing').set(auth(admin))).status).toBe(404);
    expect((await request(app.getHttpServer()).put('/api/v1/factories/factory-contract-seed-b').set(auth(managerA)).send({ name: 'Hidden edit' })).status).toBe(403);
    expect((await request(app.getHttpServer()).put('/api/v1/factories/factory-contract-seed-b').set(auth(ownerA)).send({ name: 'Hidden owner edit' })).status).toBe(403);
    expect((await request(app.getHttpServer()).post('/api/v1/factories/factory-contract-seed-b/approve').set(auth(managerA))).status).toBe(403);
  });

  it('returns only active management choices and validates an active accessible park and active approved owner', async () => {
    const adminScope = await request(app.getHttpServer()).get('/api/v1/factories/management-scope').set(auth(admin));
    expect(adminScope.status).toBe(200);
    expect(adminScope.body.parks.map(({ id }: { id: string }) => id)).toEqual(expect.arrayContaining([parkAId, parkBId]));
    expect(adminScope.body.parks.some(({ id }: { id: string }) => id === inactiveParkId)).toBe(false);
    expect(adminScope.body.owners.map(({ id }: { id: string }) => id)).toEqual(expect.arrayContaining([ownerA.id, ownerB.id, ownerFree.id]));
    expect(adminScope.body.owners.some(({ id }: { id: string }) => id === inactiveOwner.id || id === unapprovedOwner.id)).toBe(false);

    const managerScope = await request(app.getHttpServer()).get('/api/v1/factories/management-scope').set(auth(managerA));
    expect(managerScope.status).toBe(200);
    expect(managerScope.body.parks.map(({ id }: { id: string }) => id)).toEqual([parkAId]);
    expect(managerScope.body.owners.map(({ id }: { id: string }) => id)).toEqual(expect.arrayContaining([ownerA.id, ownerFree.id]));
    expect(managerScope.body.owners.some(({ id }: { id: string }) => id === ownerB.id)).toBe(false);

    const invalidCases: Array<{ actor: SeedActor; suffix: string; overrides: Record<string, unknown>; status: number }> = [
      { actor: managerA, suffix: '2001', overrides: { parkId: parkBId }, status: 403 },
      { actor: admin, suffix: '2002', overrides: { parkId: inactiveParkId }, status: 400 },
      { actor: admin, suffix: '2003', overrides: { parkId: 'factory-contract-park-missing' }, status: 400 },
      { actor: admin, suffix: '2004', overrides: { managerId: inactiveOwner.id }, status: 400 },
      { actor: admin, suffix: '2005', overrides: { managerId: unapprovedOwner.id }, status: 400 },
      { actor: admin, suffix: '2006', overrides: { managerId: employee.id }, status: 400 },
    ];
    for (const invalid of invalidCases) {
      const response = await request(app.getHttpServer()).post('/api/v1/factories').set(auth(invalid.actor))
        .send(payload(invalid.suffix, invalid.overrides));
      expect(response.status).toBe(invalid.status);
      await expect(prisma.factory.count({ where: { licenseNumber: `LIC-${invalid.suffix}` } })).resolves.toBe(0);
    }
  });

  it('creates canonical pending records, rejects lifecycle injection, and returns compatible profile and relation fields', async () => {
    const injection = await request(app.getHttpServer()).post('/api/v1/factories').set(auth(admin)).send(payload('3001', {
      status: FactoryStatus.ACTIVE,
      isApproved: true,
      rejectionReason: 'injected',
      reviewedById: admin.id,
      reviewedAt: new Date().toISOString(),
    }));
    expect(injection.status).toBe(400);
    await expect(prisma.factory.count({ where: { licenseNumber: 'LIC-3001' } })).resolves.toBe(0);

    const created = await request(app.getHttpServer()).post('/api/v1/factories').set(auth(managerA))
      .set('X-Request-ID', 'factory-create-roundtrip').send(payload('3002', {
        phoneNumber2: ' 09126662222 ', landline: ' 02166552222 ', fax: ' ',
        email: ' OWNER@EXAMPLE.TEST ', website: ' https://example.test/factory ', description: ' Factory description ',
        licenseExpiry: '2030-01-02T00:00:00.000Z', establishedDate: '2020-03-04T00:00:00.000Z', employees: 0,
      }));
    expect(created.status).toBe(201);
    expect(created.headers['x-request-id']).toBe('factory-create-roundtrip');
    expect(created.body).toMatchObject({
      name: 'Factory 3002', licenseNumber: 'LIC-3002', nationalId: '1830020000',
      activityType: 'Advanced manufacturing', address: 'Durable factory address', phoneNumber: '09126661111',
      phoneNumber2: '09126662222', landline: '02166552222', fax: null,
      email: 'owner@example.test', website: 'https://example.test/factory', description: 'Factory description', employees: 0,
      status: FactoryStatus.PENDING, isApproved: false, rejectionReason: null, reviewedAt: null, reviewedBy: null,
      parkId: parkAId, managerId: ownerA.id,
      park: { id: parkAId, code: 'FACTORY-CONTRACT-A', status: ParkStatus.ACTIVE },
      manager: { id: ownerA.id, phoneNumber: '09126660004', email: 'factory-contract-owner-a@example.test' },
    });
    expect(created.body).toEqual(expect.objectContaining({ id: expect.any(String), createdAt: expect.any(String), updatedAt: expect.any(String) }));
    expect(created.body.pendingChanges).toBeUndefined();
    await expect(prisma.factory.findUniqueOrThrow({ where: { id: created.body.id }, select: {
      status: true, isApproved: true, rejectionReason: true, reviewedAt: true, reviewedById: true, parkId: true, managerId: true,
    } })).resolves.toEqual({
      status: FactoryStatus.PENDING, isApproved: false, rejectionReason: null, reviewedAt: null, reviewedById: null,
      parkId: parkAId, managerId: ownerA.id,
    });
    await expect(prisma.auditLog.count({ where: { action: 'FACTORY_CREATED', entityId: created.body.id, correlationId: 'factory-create-roundtrip' } })).resolves.toBe(1);

    const legacy = await request(app.getHttpServer()).get('/api/v1/factories').set(auth(ownerA));
    expect(Array.isArray(legacy.body)).toBe(true);
    expect(legacy.body.find(({ id }: { id: string }) => id === created.body.id)).toMatchObject({
      id: created.body.id, status: FactoryStatus.PENDING, park: { id: parkAId }, manager: { id: ownerA.id },
    });
  });

  it('round-trips profile updates, rejects relation/lifecycle/review fields, reports uniqueness, and survives fresh login', async () => {
    const target = await createFactory('factory-contract-update-target', parkAId, ownerA.id, {
      licenseNumber: 'FACTORY-UPDATE-LICENSE', nationalId: '1888800001', description: 'Before',
    });
    const updated = await request(app.getHttpServer()).put(`/api/v1/factories/${target.id}`).set(auth(ownerA))
      .set('X-Request-ID', 'factory-update-roundtrip').send({
        name: ' Updated profile ', activityType: ' Precision tools ', address: ' Updated address ', phoneNumber: ' 09126663333 ',
        phoneNumber2: '', landline: ' 02166553333 ', fax: '', email: ' PROFILE@EXAMPLE.TEST ',
        website: '', description: ' Updated description ', licenseExpiry: '',
        establishedDate: '2021-05-06T00:00:00.000Z', employees: 42,
      });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: target.id, name: 'Updated profile', activityType: 'Precision tools', address: 'Updated address',
      phoneNumber: '09126663333', phoneNumber2: null, landline: '02166553333', fax: null,
      email: 'profile@example.test', website: null, description: 'Updated description', licenseExpiry: null,
      employees: 42, status: FactoryStatus.PENDING, isApproved: false, parkId: parkAId, managerId: ownerA.id,
      park: { id: parkAId }, manager: { id: ownerA.id },
    });
    expect(updated.body.establishedDate).toBe('2021-05-06T00:00:00.000Z');

    const protectedBodies = [
      { status: FactoryStatus.ACTIVE }, { isApproved: true }, { parkId: parkBId }, { managerId: ownerB.id },
      { rejectionReason: 'forged' }, { reviewedAt: new Date().toISOString() }, { reviewedById: admin.id }, { reviewedBy: { id: admin.id } },
    ];
    for (const body of protectedBodies) {
      const response = await request(app.getHttpServer()).put(`/api/v1/factories/${target.id}`).set(auth(admin)).send(body);
      expect(response.status).toBe(400);
    }
    await expect(prisma.factory.findUniqueOrThrow({ where: { id: target.id }, select: {
      status: true, isApproved: true, parkId: true, managerId: true, rejectionReason: true, reviewedAt: true, reviewedById: true,
    } })).resolves.toEqual({
      status: FactoryStatus.PENDING, isApproved: false, parkId: parkAId, managerId: ownerA.id,
      rejectionReason: null, reviewedAt: null, reviewedById: null,
    });

    for (const [suffix, conflict, absentWhere] of [
      ['4001', { licenseNumber: 'FACTORY-UPDATE-LICENSE' }, { nationalId: '1840010000' }],
      ['4002', { nationalId: '1888800001' }, { licenseNumber: 'LIC-4002' }],
    ] as const) {
      const auditCountBefore = await prisma.auditLog.count({ where: { action: 'FACTORY_CREATED', entity: 'Factory' } });
      const response = await request(app.getHttpServer()).post('/api/v1/factories').set(auth(admin)).send(payload(suffix, conflict));
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ statusCode: 409, code: 'UNIQUE_CONFLICT' });
      await expect(prisma.factory.count({ where: absentWhere })).resolves.toBe(0);
      await expect(prisma.auditLog.count({ where: { action: 'FACTORY_CREATED', entity: 'Factory' } })).resolves.toBe(auditCountBefore);
    }

    const login = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ phoneNumber: '09126660001', password: adminPassword });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ user: { id: admin.id, role: Role.SUPER_ADMIN }, accessToken: expect.any(String) });
    const freshRead = await request(app.getHttpServer()).get(`/api/v1/factories/managed/${target.id}`)
      .set({ Authorization: `Bearer ${login.body.accessToken}` });
    expect(freshRead.status).toBe(200);
    expect(freshRead.body).toMatchObject(updated.body);
  });

  it('records approval and trimmed rejection metadata once and keeps invalid or terminal decisions non-mutating', async () => {
    const approvedTarget = await createFactory('factory-contract-approve', parkAId, ownerA.id);
    const approved = await request(app.getHttpServer()).post(`/api/v1/factories/${approvedTarget.id}/approve`)
      .set(auth(managerA)).set('X-Request-ID', 'factory-approve-winner');
    expect(approved.status).toBe(201);
    expect(approved.body).toMatchObject({
      id: approvedTarget.id, status: FactoryStatus.ACTIVE, isApproved: true,
      rejectionReason: null, reviewedBy: { id: managerA.id },
    });
    expect(approved.body.reviewedAt).toEqual(expect.any(String));

    const rejectedTarget = await createFactory('factory-contract-reject', parkAId, ownerA.id);
    const rejected = await request(app.getHttpServer()).post(`/api/v1/factories/${rejectedTarget.id}/reject`)
      .set(auth(managerA)).set('X-Request-ID', 'factory-reject-winner').send({ reason: '  دلیل معتبر کارخانه  ' });
    expect(rejected.status).toBe(201);
    expect(rejected.body).toMatchObject({
      id: rejectedTarget.id, status: FactoryStatus.INACTIVE, isApproved: false,
      rejectionReason: 'دلیل معتبر کارخانه', reviewedBy: { id: managerA.id },
    });
    expect(rejected.body.reviewedAt).toEqual(expect.any(String));

    const invalidTarget = await createFactory('factory-contract-invalid-reason', parkAId, ownerA.id);
    for (const reason of [undefined, '', '   ', 42, 'x'.repeat(2001)]) {
      const response = await request(app.getHttpServer()).post(`/api/v1/factories/${invalidTarget.id}/reject`)
        .set(auth(managerA)).send(reason === undefined ? {} : { reason });
      expect(response.status).toBe(400);
    }
    await expect(prisma.factory.findUniqueOrThrow({ where: { id: invalidTarget.id }, select: {
      status: true, isApproved: true, rejectionReason: true, reviewedAt: true, reviewedById: true,
    } })).resolves.toEqual({
      status: FactoryStatus.PENDING, isApproved: false, rejectionReason: null, reviewedAt: null, reviewedById: null,
    });
    await expect(prisma.auditLog.count({ where: { entity: 'Factory', entityId: invalidTarget.id } })).resolves.toBe(0);

    expect((await request(app.getHttpServer()).post(`/api/v1/factories/${approvedTarget.id}/reject`)
      .set(auth(managerA)).send({ reason: 'Too late' })).status).toBe(409);
    expect((await request(app.getHttpServer()).post(`/api/v1/factories/${rejectedTarget.id}/approve`).set(auth(managerA))).status).toBe(409);
    await expect(prisma.auditLog.count({ where: { entity: 'Factory', entityId: approvedTarget.id } })).resolves.toBe(1);
    await expect(prisma.auditLog.count({ where: { entity: 'Factory', entityId: rejectedTarget.id } })).resolves.toBe(1);
  });

  it('commits exactly one concurrent approve-versus-reject winner and exposes it to a fresh session', async () => {
    const target = await createFactory('factory-contract-race', parkAId, ownerA.id);
    const [approve, reject] = await Promise.all([
      request(app.getHttpServer()).post(`/api/v1/factories/${target.id}/approve`)
        .set(auth(managerA)).set('X-Request-ID', 'factory-race-approve'),
      request(app.getHttpServer()).post(`/api/v1/factories/${target.id}/reject`)
        .set(auth(managerA)).set('X-Request-ID', 'factory-race-reject').send({ reason: ' Concurrent rejection ' }),
    ]);
    expect([approve.status, reject.status].sort()).toEqual([201, 409]);
    const winner = [approve, reject].find(({ status }) => status === 201)!;
    const loser = [approve, reject].find(({ status }) => status === 409)!;
    const row = await prisma.factory.findUniqueOrThrow({ where: { id: target.id } });
    expect(row.status).toBe(winner.body.status);
    expect(row.isApproved).toBe(winner.body.status === FactoryStatus.ACTIVE);
    expect(row.rejectionReason).toBe(winner.body.status === FactoryStatus.INACTIVE ? 'Concurrent rejection' : null);
    expect(row.reviewedById).toBe(managerA.id);
    expect(row.reviewedAt).not.toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: { entity: 'Factory', entityId: target.id, action: { in: ['FACTORY_APPROVED', 'FACTORY_REJECTED'] } },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].correlationId).toBe(winner.headers['x-request-id']);
    expect(audits[0].correlationId).not.toBe(loser.headers['x-request-id']);

    const freshLogin = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ phoneNumber: '09126660001', password: adminPassword });
    expect(freshLogin.status).toBe(200);
    const freshAuth = { Authorization: `Bearer ${freshLogin.body.accessToken}` };
    const detail = await request(app.getHttpServer()).get(`/api/v1/factories/managed/${target.id}`).set(freshAuth);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      id: target.id, status: row.status, isApproved: row.isApproved,
      rejectionReason: row.rejectionReason, reviewedBy: { id: managerA.id }, park: { id: parkAId }, manager: { id: ownerA.id },
    });
    const page = await request(app.getHttpServer()).get('/api/v1/factories/managed?page=1&pageSize=100').set(freshAuth);
    expect(page.status).toBe(200);
    expect(page.body.items.find(({ id }: { id: string }) => id === target.id)).toMatchObject(detail.body);
  });

  it('rolls a pending decision back when its audit trigger fails and preserves unrelated data', async () => {
    const target = await createFactory('factory-contract-audit-rollback', parkAId, ownerA.id);
    const unrelated = await prisma.auditLog.create({
      data: { actorIdentifier: 'factory-contract-preserved', action: 'UNRELATED_PRESERVED', entity: 'Other', entityId: 'factory-contract-unrelated' },
    });
    const before = await prisma.factory.findUniqueOrThrow({ where: { id: target.id } });

    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "test_fail_factory_audit_fn"() RETURNS trigger AS $$
      BEGIN
        IF NEW."entity" = 'Factory' AND NEW."entityId" = '${target.id}' THEN
          RAISE EXCEPTION 'intentional factory audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "test_fail_factory_audit"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "test_fail_factory_audit_fn"()
    `);

    try {
      const response = await request(app.getHttpServer()).post(`/api/v1/factories/${target.id}/approve`)
        .set(auth(managerA)).set('X-Request-ID', 'factory-audit-rollback');
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR', correlationId: 'factory-audit-rollback' });
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "test_fail_factory_audit" ON "AuditLog"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "test_fail_factory_audit_fn"()');
    }

    await expect(prisma.factory.findUniqueOrThrow({ where: { id: target.id } })).resolves.toEqual(before);
    await expect(prisma.factory.findUniqueOrThrow({ where: { id: target.id }, select: {
      status: true, isApproved: true, rejectionReason: true, reviewedAt: true, reviewedById: true,
    } })).resolves.toEqual({
      status: FactoryStatus.PENDING, isApproved: false, rejectionReason: null, reviewedAt: null, reviewedById: null,
    });
    await expect(prisma.auditLog.count({ where: { entity: 'Factory', entityId: target.id } })).resolves.toBe(0);
    await expect(prisma.auditLog.findUnique({ where: { id: unrelated.id } })).resolves.toMatchObject({
      id: unrelated.id, action: 'UNRELATED_PRESERVED', entityId: 'factory-contract-unrelated',
    });
  });
});
