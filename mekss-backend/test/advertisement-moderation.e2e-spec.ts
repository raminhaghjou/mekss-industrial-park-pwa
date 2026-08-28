import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AdvertisementStatus, ParkStatus, Role } from '@prisma/client';
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
  phoneNumber: '02177770000',
  guardPhone: '02177770001',
  status,
});

type SeedActor = { id: string; token: string };

describe('Scoped conflict-safe advertisement moderation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let admin: SeedActor;
  let managerA: SeedActor;
  let managerB: SeedActor;
  let ownerSingle: SeedActor;
  let ownerMulti: SeedActor;
  let ownerZero: SeedActor;
  let employee: SeedActor;

  const parkAId = 'ad-contract-park-a';
  const parkBId = 'ad-contract-park-b';
  const parkCId = 'ad-contract-park-c';
  const inactiveParkId = 'ad-contract-park-inactive';
  const categoryId = 'ad-contract-category';
  const categoryKey = 'AD_CONTRACT_OTHER';
  const auth = (actor: SeedActor) => ({ Authorization: `Bearer ${actor.token}` });

  const issueCurrentToken = async (userId: string) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
    return jwt.signAsync({ sub: userId, sessionVersion: user.sessionVersion });
  };

  const createActor = async (id: string, phoneNumber: string, role: Role): Promise<SeedActor> => {
    await prisma.user.create({
      data: { id, phoneNumber, password: 'not-used', name: id, role, isApproved: true, isActive: true },
    });
    return { id, token: await issueCurrentToken(id) };
  };

  const createAdvertisement = async (
    id: string,
    parkId: string | null,
    status: AdvertisementStatus = AdvertisementStatus.PENDING,
    overrides: Record<string, unknown> = {},
  ) => prisma.advertisement.create({
    data: {
      id,
      title: `Advertisement ${id}`,
      categoryId,
      province: 'Tehran',
      city: 'Tehran',
      address: 'Scoped address',
      content: `Scoped content ${id}`,
      contactInfo: { phone: '09127777000', email: 'public@example.com', privateNote: 'must-never-leak' },
      images: ['https://example.test/image.webp'],
      parkId,
      createdById: ownerSingle.id,
      status,
      isApproved: status === AdvertisementStatus.APPROVED,
      rejectionReason: status === AdvertisementStatus.REJECTED ? 'Existing terminal reason' : null,
      ...overrides,
    },
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    [admin, managerA, managerB, ownerSingle, ownerMulti, ownerZero, employee] = await Promise.all([
      createActor('ad-contract-admin', '09127777001', Role.SUPER_ADMIN),
      createActor('ad-contract-manager-a', '09127777002', Role.PARK_MANAGER),
      createActor('ad-contract-manager-b', '09127777003', Role.PARK_MANAGER),
      createActor('ad-contract-owner-single', '09127777004', Role.FACTORY_OWNER),
      createActor('ad-contract-owner-multi', '09127777005', Role.FACTORY_OWNER),
      createActor('ad-contract-owner-zero', '09127777006', Role.FACTORY_OWNER),
      createActor('ad-contract-employee', '09127777007', Role.EMPLOYEE),
    ]);

    await prisma.industrialPark.createMany({
      data: [
        parkData(parkAId, 'AD-CONTRACT-A'),
        parkData(parkBId, 'AD-CONTRACT-B'),
        parkData(parkCId, 'AD-CONTRACT-C'),
        parkData(inactiveParkId, 'AD-CONTRACT-INACTIVE', ParkStatus.INACTIVE),
      ],
    });
    await Promise.all([
      prisma.industrialPark.update({ where: { id: parkAId }, data: { managers: { connect: { id: managerA.id } } } }),
      prisma.industrialPark.update({ where: { id: parkBId }, data: { managers: { connect: { id: managerB.id } } } }),
      prisma.advertisementCategoryDef.create({ data: { id: categoryId, key: categoryKey, label: 'Contract category' } }),
      prisma.advertisementCategoryDef.create({ data: { id: 'ad-contract-category-inactive', key: 'AD_CONTRACT_INACTIVE', label: 'Inactive', isActive: false } }),
    ]);
    await prisma.factory.createMany({ data: [
      {
        id: 'ad-contract-factory-single', name: 'Single owner factory', licenseNumber: 'AD-CONTRACT-LIC-1',
        nationalId: '1400777001', activityType: 'Manufacturing', address: 'Address', phoneNumber: '09127777101',
        managerId: ownerSingle.id, parkId: parkAId, isApproved: true,
      },
      {
        id: 'ad-contract-factory-multi-a', name: 'Multi owner factory A', licenseNumber: 'AD-CONTRACT-LIC-2',
        nationalId: '1400777002', activityType: 'Manufacturing', address: 'Address', phoneNumber: '09127777102',
        managerId: ownerMulti.id, parkId: parkAId, isApproved: true,
      },
      {
        id: 'ad-contract-factory-multi-b', name: 'Multi owner factory B', licenseNumber: 'AD-CONTRACT-LIC-3',
        nationalId: '1400777003', activityType: 'Manufacturing', address: 'Address', phoneNumber: '09127777103',
        managerId: ownerMulti.id, parkId: parkBId, isApproved: true,
      },
      {
        id: 'ad-contract-factory-inactive', name: 'Inactive park factory', licenseNumber: 'AD-CONTRACT-LIC-4',
        nationalId: '1400777004', activityType: 'Manufacturing', address: 'Address', phoneNumber: '09127777104',
        managerId: ownerZero.id, parkId: inactiveParkId, isApproved: true,
      },
    ] });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.advertisement.deleteMany({
        where: { createdById: { in: [ownerSingle?.id, ownerMulti?.id, ownerZero?.id].filter(Boolean) as string[] } },
      });
      await prisma.factory.deleteMany({
        where: { managerId: { in: [ownerSingle?.id, ownerMulti?.id, ownerZero?.id].filter(Boolean) as string[] } },
      });
      await prisma.advertisementCategoryDef.deleteMany({
        where: { key: { in: [categoryKey, 'AD_CONTRACT_INACTIVE'] } },
      });
      await prisma.industrialPark.deleteMany({
        where: { id: { in: [parkAId, parkBId, parkCId, inactiveParkId] } },
      });
    }
    if (app) await app.close();
  });

  it('preserves unauthenticated approved-only reads', async () => {
    const approved = await createAdvertisement('ad-contract-public-approved', parkAId, AdvertisementStatus.APPROVED);
    const pending = await createAdvertisement('ad-contract-public-pending', parkAId);

    const response = await request(app.getHttpServer()).get('/api/v1/advertisements');
    expect(response.status).toBe(200);
    expect(response.body.some(({ id }: { id: string }) => id === approved.id)).toBe(true);
    expect(response.body.some(({ id }: { id: string }) => id === pending.id)).toBe(false);
    expect(response.body.every(({ status }: { status: AdvertisementStatus }) => status === AdvertisementStatus.APPROVED)).toBe(true);
  });

  it('derives active creation scope and validates zero, one, multiple, and mismatched scopes', async () => {
    const singleScope = await request(app.getHttpServer()).get('/api/v1/advertisements/creation-scope').set(auth(ownerSingle));
    expect(singleScope.status).toBe(200);
    expect(singleScope.body).toMatchObject({ canCreate: true, requiresSelection: false, autoSelectedParkId: parkAId });
    expect(singleScope.body.parks.map(({ id }: { id: string }) => id)).toEqual([parkAId]);

    const createdSingle = await request(app.getHttpServer()).post('/api/v1/advertisements').set(auth(ownerSingle)).send({
      title: '  Single scope advertisement  ', category: categoryKey, province: ' Tehran ', city: ' Tehran ',
      content: ' Scoped creation content ', contactInfo: { phone: '09127777020' },
    });
    expect(createdSingle.status).toBe(201);
    expect(createdSingle.body).toMatchObject({ title: 'Single scope advertisement', park: { id: parkAId }, status: 'PENDING' });
    expect(createdSingle.body.contactInfo).toEqual({ phone: '09127777020' });
    await expect(prisma.advertisement.findUniqueOrThrow({ where: { id: createdSingle.body.id }, select: { parkId: true, contactInfo: true } }))
      .resolves.toEqual({ parkId: parkAId, contactInfo: { phone: '09127777020' } });

    const multiScope = await request(app.getHttpServer()).get('/api/v1/advertisements/creation-scope').set(auth(ownerMulti));
    expect(multiScope.status).toBe(200);
    expect(multiScope.body).toMatchObject({ canCreate: true, requiresSelection: true, autoSelectedParkId: null });
    expect(new Set(multiScope.body.parks.map(({ id }: { id: string }) => id))).toEqual(new Set([parkAId, parkBId]));

    const basePayload = {
      title: 'Multiple scope advertisement', category: categoryKey, province: 'Tehran', city: 'Tehran',
      content: 'Multiple scope content', contactInfo: { phoneNumber: '09127777021' },
    };
    expect((await request(app.getHttpServer()).post('/api/v1/advertisements').set(auth(ownerMulti)).send(basePayload)).status).toBe(400);
    expect((await request(app.getHttpServer()).post('/api/v1/advertisements').set(auth(ownerMulti)).send({ ...basePayload, parkId: parkCId })).status).toBe(403);
    const createdMulti = await request(app.getHttpServer()).post('/api/v1/advertisements').set(auth(ownerMulti)).send({ ...basePayload, parkId: parkBId });
    expect(createdMulti.status).toBe(201);
    expect(createdMulti.body.park.id).toBe(parkBId);

    const zeroScope = await request(app.getHttpServer()).get('/api/v1/advertisements/creation-scope').set(auth(ownerZero));
    expect(zeroScope.status).toBe(200);
    expect(zeroScope.body).toMatchObject({ canCreate: false, requiresSelection: false, autoSelectedParkId: null, parks: [] });
    expect((await request(app.getHttpServer()).post('/api/v1/advertisements').set(auth(ownerZero)).send(basePayload)).status).toBe(403);
    expect((await request(app.getHttpServer()).post('/api/v1/advertisements').set(auth(ownerSingle)).send({ ...basePayload, category: 'AD_CONTRACT_INACTIVE' })).status).toBe(400);
  });

  it('returns deterministic scoped pages and safe detail while keeping legacy arrays compatible', async () => {
    const createdAt = new Date('2026-08-28T10:30:00.000Z');
    await Promise.all([
      createAdvertisement('ad-contract-order-a', parkAId, AdvertisementStatus.PENDING, { title: 'Search needle A', createdAt }),
      createAdvertisement('ad-contract-order-b', parkAId, AdvertisementStatus.PENDING, { title: 'Search needle B', createdAt }),
      createAdvertisement('ad-contract-scope-b', parkBId, AdvertisementStatus.PENDING, { title: 'Search needle hidden', createdAt }),
      createAdvertisement('ad-contract-history-a', parkAId, AdvertisementStatus.EXPIRED, { title: 'History A' }),
    ]);

    const first = await request(app.getHttpServer())
      .get(`/api/v1/advertisements/managed?view=PENDING&search=needle&parkId=${parkAId}&page=1&pageSize=1`)
      .set(auth(managerA));
    const second = await request(app.getHttpServer())
      .get(`/api/v1/advertisements/managed?view=PENDING&search=needle&parkId=${parkAId}&page=2&pageSize=1`)
      .set(auth(managerA));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toMatchObject({ total: 2, page: 1, pageSize: 1, availableParks: [{ id: parkAId }] });
    expect([first.body.items[0].id, second.body.items[0].id]).toEqual(['ad-contract-order-a', 'ad-contract-order-b']);
    expect(first.body.items[0].contactInfo).toEqual({ phone: '09127777000', email: 'public@example.com' });
    expect(JSON.stringify(first.body)).not.toContain('privateNote');

    const detail = await request(app.getHttpServer()).get('/api/v1/advertisements/managed/ad-contract-order-a').set(auth(managerA));
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ id: 'ad-contract-order-a', park: { id: parkAId }, images: ['https://example.test/image.webp'] });
    expect(detail.body.contactInfo).toEqual({ phone: '09127777000', email: 'public@example.com' });
    expect(JSON.stringify(detail.body)).not.toContain('must-never-leak');

    expect((await request(app.getHttpServer()).get('/api/v1/advertisements/managed/ad-contract-scope-b').set(auth(managerA))).status).toBe(403);
    expect((await request(app.getHttpServer()).get(`/api/v1/advertisements/managed?parkId=${parkBId}`).set(auth(managerA))).status).toBe(403);
    const pendingLegacy = await request(app.getHttpServer()).get('/api/v1/advertisements/managed/pending').set(auth(managerA));
    const historyLegacy = await request(app.getHttpServer()).get('/api/v1/advertisements/managed/history').set(auth(managerA));
    expect(pendingLegacy.status).toBe(200);
    expect(pendingLegacy.body.some(({ id }: { id: string }) => id === 'ad-contract-order-a')).toBe(true);
    expect(pendingLegacy.body.some(({ id }: { id: string }) => id === 'ad-contract-scope-b')).toBe(false);
    expect(historyLegacy.body.some(({ id }: { id: string }) => id === 'ad-contract-history-a')).toBe(true);

    expect((await request(app.getHttpServer()).get('/api/v1/advertisements/managed?view=PENDING&status=APPROVED').set(auth(admin))).status).toBe(400);
    expect((await request(app.getHttpServer()).get('/api/v1/advertisements/managed?view=HISTORY&status=PENDING').set(auth(admin))).status).toBe(400);
  });

  it('makes terminal, invalid-reason, unauthorized, and ambiguous-scope decisions non-mutating', async () => {
    const terminalCases = [AdvertisementStatus.APPROVED, AdvertisementStatus.REJECTED, AdvertisementStatus.EXPIRED];
    for (const status of terminalCases) {
      const id = `ad-contract-terminal-${status.toLowerCase()}`;
      await createAdvertisement(id, parkAId, status);
      const before = await prisma.advertisement.findUniqueOrThrow({ where: { id } });
      for (const body of [{ approved: true }, { approved: false, rejectionReason: 'A reason' }]) {
        const response = await request(app.getHttpServer()).post(`/api/v1/advertisements/${id}/approve`).set(auth(managerA)).send(body);
        expect(response.status).toBe(409);
      }
      await expect(prisma.advertisement.findUniqueOrThrow({ where: { id } })).resolves.toEqual(before);
      await expect(prisma.auditLog.count({ where: { entity: 'Advertisement', entityId: id } })).resolves.toBe(0);
    }

    const reasonId = 'ad-contract-reason-matrix';
    await createAdvertisement(reasonId, parkAId);
    for (const rejectionReason of [undefined, '', '   ', 42, 'x'.repeat(2001)]) {
      const body = rejectionReason === undefined ? { approved: false } : { approved: false, rejectionReason };
      const response = await request(app.getHttpServer()).post(`/api/v1/advertisements/${reasonId}/approve`).set(auth(managerA)).send(body);
      expect(response.status).toBe(400);
    }
    await expect(prisma.advertisement.findUniqueOrThrow({ where: { id: reasonId }, select: { status: true } }))
      .resolves.toEqual({ status: AdvertisementStatus.PENDING });

    const rejected = await request(app.getHttpServer()).post(`/api/v1/advertisements/${reasonId}/approve`)
      .set(auth(managerA)).set('X-Request-ID', 'ad-reason-winner').send({ approved: false, rejectionReason: '  دلیل معتبر فارسی  ' });
    expect(rejected.status).toBe(201);
    expect(rejected.body).toMatchObject({ status: 'REJECTED', isApproved: false, rejectionReason: 'دلیل معتبر فارسی', moderatedBy: { id: managerA.id } });
    expect(rejected.body.moderatedAt).toBeTruthy();
    expect((await request(app.getHttpServer()).post(`/api/v1/advertisements/${reasonId}/approve`).set(auth(managerA)).send({ approved: true })).status).toBe(409);
    const reasonAudits = await prisma.auditLog.findMany({ where: { entity: 'Advertisement', entityId: reasonId } });
    expect(reasonAudits).toHaveLength(1);
    expect(reasonAudits[0]).toMatchObject({ action: 'ADVERTISEMENT_REJECTED', correlationId: 'ad-reason-winner' });

    const unauthorizedId = 'ad-contract-unauthorized';
    await createAdvertisement(unauthorizedId, parkAId);
    expect((await request(app.getHttpServer()).post(`/api/v1/advertisements/${unauthorizedId}/approve`).set(auth(employee)).send({ approved: true })).status).toBe(403);
    expect((await request(app.getHttpServer()).post(`/api/v1/advertisements/${unauthorizedId}/approve`).set(auth(managerB)).send({ approved: true })).status).toBe(403);
    await expect(prisma.advertisement.findUniqueOrThrow({ where: { id: unauthorizedId }, select: { status: true } }))
      .resolves.toEqual({ status: AdvertisementStatus.PENDING });

    const ambiguousId = 'ad-contract-ambiguous';
    await createAdvertisement(ambiguousId, null);
    expect((await request(app.getHttpServer()).get(`/api/v1/advertisements/managed/${ambiguousId}`).set(auth(admin))).status).toBe(200);
    expect((await request(app.getHttpServer()).get(`/api/v1/advertisements/managed/${ambiguousId}`).set(auth(managerA))).status).toBe(403);
    expect((await request(app.getHttpServer()).post(`/api/v1/advertisements/${ambiguousId}/approve`).set(auth(admin)).send({ approved: true })).status).toBe(403);
    await expect(prisma.advertisement.findUniqueOrThrow({ where: { id: ambiguousId }, select: { status: true, moderatedAt: true, moderatedById: true } }))
      .resolves.toEqual({ status: AdvertisementStatus.PENDING, moderatedAt: null, moderatedById: null });
    await expect(prisma.auditLog.count({ where: { entity: 'Advertisement', entityId: ambiguousId } })).resolves.toBe(0);
  });

  it('commits exactly one winner in an approve-versus-reject race and exposes durable fresh-session history', async () => {
    const id = 'ad-contract-concurrent';
    await createAdvertisement(id, parkAId);
    const requestIds = ['ad-race-approve', 'ad-race-reject'];
    const [approve, reject] = await Promise.all([
      request(app.getHttpServer()).post(`/api/v1/advertisements/${id}/approve`).set(auth(managerA)).set('X-Request-ID', requestIds[0]).send({ approved: true }),
      request(app.getHttpServer()).post(`/api/v1/advertisements/${id}/approve`).set(auth(managerA)).set('X-Request-ID', requestIds[1]).send({ approved: false, rejectionReason: 'Concurrent rejection' }),
    ]);
    expect([approve.status, reject.status].sort()).toEqual([201, 409]);
    const winner = [approve, reject].find(({ status }) => status === 201)!;
    const loser = [approve, reject].find(({ status }) => status === 409)!;
    const row = await prisma.advertisement.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe(winner.body.status);
    expect(row.isApproved).toBe(winner.body.status === AdvertisementStatus.APPROVED);
    expect(row.rejectionReason).toBe(winner.body.status === AdvertisementStatus.REJECTED ? 'Concurrent rejection' : null);
    expect(row.moderatedById).toBe(managerA.id);
    expect(row.moderatedAt).not.toBeNull();
    const audits = await prisma.auditLog.findMany({ where: { entity: 'Advertisement', entityId: id } });
    expect(audits).toHaveLength(1);
    expect(audits[0].correlationId).toBe(winner.headers['x-request-id']);
    expect(audits[0].correlationId).not.toBe(loser.headers['x-request-id']);

    const freshManager = { ...managerA, token: await issueCurrentToken(managerA.id) };
    const history = await request(app.getHttpServer()).get('/api/v1/advertisements/managed?view=HISTORY&page=1&pageSize=100').set(auth(freshManager));
    expect(history.status).toBe(200);
    expect(history.body.items.find((item: { id: string }) => item.id === id)).toMatchObject({
      id, status: row.status, moderatedBy: { id: managerA.id }, moderatedAt: expect.any(String),
    });
    const detail = await request(app.getHttpServer()).get(`/api/v1/advertisements/managed/${id}`).set(auth(freshManager));
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ id, status: row.status, moderatedBy: { id: managerA.id } });
    const pending = await request(app.getHttpServer()).get('/api/v1/advertisements/managed?view=PENDING&pageSize=100').set(auth(freshManager));
    expect(pending.body.items.some((item: { id: string }) => item.id === id)).toBe(false);
  });

  it('rolls back the moderation row and audit atomically when audit persistence fails', async () => {
    const id = 'ad-contract-audit-rollback';
    await createAdvertisement(id, parkAId);
    const unrelated = await prisma.auditLog.create({
      data: { actorIdentifier: 'preserved', action: 'UNRELATED_PRESERVED', entity: 'Other', entityId: 'unrelated-ad-contract' },
    });
    const before = await prisma.advertisement.findUniqueOrThrow({ where: { id } });

    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "test_fail_advertisement_audit_fn"() RETURNS trigger AS $$
      BEGIN
        IF NEW."entity" = 'Advertisement' AND NEW."entityId" = '${id}' THEN
          RAISE EXCEPTION 'intentional advertisement audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "test_fail_advertisement_audit"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "test_fail_advertisement_audit_fn"()
    `);

    try {
      const response = await request(app.getHttpServer()).post(`/api/v1/advertisements/${id}/approve`)
        .set(auth(managerA)).set('X-Request-ID', 'ad-audit-rollback').send({ approved: true });
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR', correlationId: 'ad-audit-rollback' });
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "test_fail_advertisement_audit" ON "AuditLog"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "test_fail_advertisement_audit_fn"()');
    }

    await expect(prisma.advertisement.findUniqueOrThrow({ where: { id } })).resolves.toEqual(before);
    await expect(prisma.auditLog.count({ where: { entity: 'Advertisement', entityId: id } })).resolves.toBe(0);
    await expect(prisma.auditLog.findUnique({ where: { id: unrelated.id } })).resolves.toMatchObject({
      id: unrelated.id, action: 'UNRELATED_PRESERVED', entityId: 'unrelated-ad-contract',
    });
  });
});
