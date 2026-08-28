import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ParkStatus, Role } from '@prisma/client';
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

const parkPayload = (code: string) => ({
  code,
  name: `${code} industrial park`,
  province: 'Tehran',
  city: 'Tehran',
  address: `${code} integration address`,
  phoneNumber: '02112345678',
  guardPhone: '02187654321',
});

describe('Transactional industrial-park CRUD contract (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let adminId: string;
  let adminToken: string;
  let managerToken: string;
  let managerAId: string;
  let managerBId: string;
  let inactiveManagerId: string;
  let unapprovedManagerId: string;
  let ownerId: string;
  let guardId: string;
  let categoryId: string;

  const adminPassword = 'ParkContract123';
  const auth = (token = adminToken) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const password = await bcrypt.hash(adminPassword, 4);
    const users = await Promise.all([
      prisma.user.create({ data: { phoneNumber: '09123333000', password, name: 'Park Contract Admin', role: Role.SUPER_ADMIN, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09123333001', password: 'unused', name: 'Manager Alpha', role: Role.PARK_MANAGER, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09123333002', password: 'unused', name: 'Manager Beta', role: Role.PARK_MANAGER, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09123333003', password: 'unused', name: 'Inactive Manager', role: Role.PARK_MANAGER, isApproved: true, isActive: false } }),
      prisma.user.create({ data: { phoneNumber: '09123333004', password: 'unused', name: 'Unapproved Manager', role: Role.PARK_MANAGER, isApproved: false, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09123333005', password: 'unused', name: 'Factory Owner', role: Role.FACTORY_OWNER, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09123333006', password: 'unused', name: 'Security Guard', role: Role.SECURITY_GUARD, isApproved: true, isActive: true } }),
    ]);
    const [admin, managerA, managerB, inactiveManager, unapprovedManager, owner, guard] = users;
    adminId = admin.id;
    managerAId = managerA.id;
    managerBId = managerB.id;
    inactiveManagerId = inactiveManager.id;
    unapprovedManagerId = unapprovedManager.id;
    ownerId = owner.id;
    guardId = guard.id;
    adminToken = await jwt.signAsync({ sub: admin.id });
    managerToken = await jwt.signAsync({ sub: managerA.id });
    const category = await prisma.advertisementCategoryDef.create({
      data: { key: 'PARK_CONTRACT_CATEGORY', label: 'Park contract category', isActive: true },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('paginates and searches a stable snapshot and exposes a compatible detail representation', async () => {
    const sameCreatedAt = new Date('2026-08-28T10:00:00.000Z');
    await prisma.industrialPark.createMany({ data: [
      { id: 'park-order-a', ...parkPayload('ORDER-A'), createdAt: sameCreatedAt },
      { id: 'park-order-b', ...parkPayload('ORDER-B'), createdAt: sameCreatedAt },
    ] });

    const first = await request(app.getHttpServer())
      .get('/api/v1/industrial-parks?page=1&pageSize=1&search=ORDER')
      .set(auth())
      .set('X-Request-ID', 'park-list-first');
    const second = await request(app.getHttpServer())
      .get('/api/v1/industrial-parks?page=2&pageSize=1&search=ORDER')
      .set(auth())
      .set('X-Request-ID', 'park-list-second');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers['x-request-id']).toBe('park-list-first');
    expect(first.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(second.body).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect([first.body.items[0].id, second.body.items[0].id]).toEqual(['park-order-a', 'park-order-b']);
    expect(first.body.items[0]).toMatchObject({
      managers: [],
      _count: { factories: 0, managers: 0, announcements: 0, advertisements: 0, securityGuards: 0, scopedFiles: 0 },
    });

    const detail = await request(app.getHttpServer()).get('/api/v1/industrial-parks/park-order-a').set(auth());
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject(first.body.items[0]);
    const missing = await request(app.getHttpServer()).get('/api/v1/industrial-parks/park-order-missing').set(auth());
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('round-trips every mutable field, assignments, browser refresh, and a new login session', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/industrial-parks')
      .set(auth())
      .set('X-Request-ID', 'park-roundtrip-create')
      .send({
        code: ' ROUNDTRIP-1 ',
        name: ' Round trip park ',
        province: ' Tehran ',
        city: ' Tehran ',
        address: ' Durable address ',
        phoneNumber: ' 02111111111 ',
        guardPhone: ' 02122222222 ',
        email: ' ',
        establishedDate: ' ',
        description: ' ',
        totalArea: 125,
        status: ParkStatus.ACTIVE,
        managerIds: [managerAId],
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.headers['x-request-id']).toBe('park-roundtrip-create');
    expect(createResponse.body).toMatchObject({
      code: 'ROUNDTRIP-1', name: 'Round trip park', province: 'Tehran', city: 'Tehran', address: 'Durable address',
      phoneNumber: '02111111111', guardPhone: '02122222222', email: null, establishedDate: null,
      description: null, totalArea: 125, status: ParkStatus.ACTIVE,
      managers: [{ id: managerAId, name: 'Manager Alpha', phoneNumber: '09123333001' }],
      _count: { managers: 1 },
    });
    const parkId = createResponse.body.id as string;

    const refreshedRead = await request(app.getHttpServer()).get(`/api/v1/industrial-parks/${parkId}`).set(auth());
    expect(refreshedRead.status).toBe(200);
    expect(refreshedRead.body.id).toBe(parkId);

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/v1/industrial-parks/${parkId}`)
      .set(auth())
      .set('X-Request-ID', 'park-roundtrip-update')
      .send({
        code: ' ROUNDTRIP-2 ', name: ' Updated park ', province: ' Alborz ', city: ' Karaj ', address: ' Updated address ',
        phoneNumber: ' 02611111111 ', guardPhone: ' 02622222222 ', email: ' updated@example.com ', totalArea: 250,
        establishedDate: '2020-01-02T00:00:00.000Z', description: ' Updated description ', status: ParkStatus.INACTIVE,
        managerIds: [managerBId],
      });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      id: parkId, code: 'ROUNDTRIP-2', name: 'Updated park', province: 'Alborz', city: 'Karaj', address: 'Updated address',
      phoneNumber: '02611111111', guardPhone: '02622222222', email: 'updated@example.com', totalArea: 250,
      description: 'Updated description', status: ParkStatus.INACTIVE,
      managers: [{ id: managerBId, name: 'Manager Beta', phoneNumber: '09123333002' }],
    });
    expect(new Date(updateResponse.body.establishedDate).toISOString()).toBe('2020-01-02T00:00:00.000Z');

    const partialUpdate = await request(app.getHttpServer())
      .put(`/api/v1/industrial-parks/${parkId}`)
      .set(auth())
      .send({ city: ' New Karaj ', email: '', establishedDate: '', description: '' });
    expect(partialUpdate.status).toBe(200);
    expect(partialUpdate.body).toMatchObject({
      id: parkId, code: 'ROUNDTRIP-2', name: 'Updated park', city: 'New Karaj', email: null,
      establishedDate: null, description: null, totalArea: 250, status: ParkStatus.INACTIVE,
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber: '09123333000', password: adminPassword });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ user: { id: adminId, role: Role.SUPER_ADMIN } });
    expect(login.body.accessToken).toEqual(expect.any(String));
    const newSessionRead = await request(app.getHttpServer())
      .get(`/api/v1/industrial-parks/${parkId}`)
      .set(auth(login.body.accessToken));
    expect(newSessionRead.status).toBe(200);
    expect(newSessionRead.body).toMatchObject(partialUpdate.body);

    const clearManagers = await request(app.getHttpServer())
      .put(`/api/v1/industrial-parks/${parkId}`)
      .set(auth(login.body.accessToken))
      .send({ managerIds: [] });
    expect(clearManagers.status).toBe(200);
    expect(clearManagers.body.managers).toEqual([]);

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/v1/industrial-parks/${parkId}`)
      .set(auth(login.body.accessToken));
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ id: parkId, deleted: true });
    await expect(prisma.industrialPark.findUnique({ where: { id: parkId } })).resolves.toBeNull();
    await expect(prisma.industrialPark.findUnique({ where: { id: 'park-order-a' } })).resolves.not.toBeNull();

    const retryDelete = await request(app.getHttpServer()).delete(`/api/v1/industrial-parks/${parkId}`).set(auth());
    expect(retryDelete.status).toBe(404);
    await expect(prisma.auditLog.count({ where: { action: 'PARK_DELETED', entityId: parkId } })).resolves.toBe(1);
    await expect(prisma.auditLog.count({ where: { action: 'PARK_CREATED', entityId: parkId } })).resolves.toBe(1);
  });

  it('enforces trimmed uniqueness under retry/concurrency and rejects invalid assignments without mutation', async () => {
    const concurrentPayload = { ...parkPayload('RACE-PARK'), code: ' RACE-PARK ' };
    const responses = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/industrial-parks').set(auth()).set('X-Request-ID', 'park-race-a').send(concurrentPayload),
      request(app.getHttpServer()).post('/api/v1/industrial-parks').set(auth()).set('X-Request-ID', 'park-race-b').send(concurrentPayload),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const created = responses.find((response) => response.status === 201);
    expect(created).toBeDefined();
    await expect(prisma.industrialPark.count({ where: { code: 'RACE-PARK' } })).resolves.toBe(1);
    await expect(prisma.auditLog.count({ where: { action: 'PARK_CREATED', entityId: created?.body.id } })).resolves.toBe(1);

    const retry = await request(app.getHttpServer()).post('/api/v1/industrial-parks').set(auth()).send(concurrentPayload);
    expect(retry.status).toBe(409);
    expect(retry.body).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    await expect(prisma.industrialPark.count({ where: { code: 'RACE-PARK' } })).resolves.toBe(1);

    const invalidCases = [
      { code: 'INVALID-MANAGER-DUPLICATE', managerIds: [managerAId, managerAId] },
      { code: 'INVALID-MANAGER-INACTIVE', managerIds: [inactiveManagerId] },
      { code: 'INVALID-MANAGER-UNAPPROVED', managerIds: [unapprovedManagerId] },
      { code: 'INVALID-MANAGER-ROLE', managerIds: [ownerId] },
    ];
    for (const invalid of invalidCases) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/industrial-parks')
        .set(auth())
        .send({ ...parkPayload(invalid.code), ...invalid });
      expect(response.status).toBe(400);
      await expect(prisma.industrialPark.count({ where: { code: invalid.code } })).resolves.toBe(0);
    }

    const emptyUpdate = await request(app.getHttpServer())
      .put(`/api/v1/industrial-parks/${created?.body.id}`)
      .set(auth())
      .send({});
    expect(emptyUpdate.status).toBe(400);
  });

  it('linearizes concurrent mutable-code updates and leaves the losing park and audit unchanged', async () => {
    const left = await prisma.industrialPark.create({ data: parkPayload('UPDATE-RACE-LEFT') });
    const right = await prisma.industrialPark.create({ data: parkPayload('UPDATE-RACE-RIGHT') });
    const responses = await Promise.all([
      request(app.getHttpServer())
        .put(`/api/v1/industrial-parks/${left.id}`)
        .set(auth())
        .set('X-Request-ID', 'park-update-race-left')
        .send({ code: ' UPDATE-RACE-WINNER ' }),
      request(app.getHttpServer())
        .put(`/api/v1/industrial-parks/${right.id}`)
        .set(auth())
        .set('X-Request-ID', 'park-update-race-right')
        .send({ code: 'UPDATE-RACE-WINNER' }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const winner = responses.find((response) => response.status === 200);
    const loser = responses.find((response) => response.status === 409);
    expect(winner?.body.code).toBe('UPDATE-RACE-WINNER');
    expect(loser?.body.code).toMatch(/^(CONFLICT|UNIQUE_CONFLICT)$/);

    const winningId = winner?.body.id as string;
    const losingFixture = winningId === left.id ? right : left;
    await expect(prisma.industrialPark.count({ where: { code: 'UPDATE-RACE-WINNER' } })).resolves.toBe(1);
    await expect(prisma.industrialPark.findUniqueOrThrow({ where: { id: losingFixture.id } })).resolves.toMatchObject({
      code: losingFixture.code,
    });
    await expect(prisma.auditLog.count({ where: { action: 'PARK_UPDATED', entityId: winningId } })).resolves.toBe(1);
    await expect(prisma.auditLog.count({ where: { action: 'PARK_UPDATED', entityId: losingFixture.id } })).resolves.toBe(0);
  });

  it('denies non-super-admin and stale canonical actors before disclosure or mutation', async () => {
    const target = await prisma.industrialPark.create({ data: parkPayload('AUTH-TARGET') });
    const deniedCalls = [
      request(app.getHttpServer()).get('/api/v1/industrial-parks').set(auth(managerToken)),
      request(app.getHttpServer()).get(`/api/v1/industrial-parks/${target.id}`).set(auth(managerToken)),
      request(app.getHttpServer()).post('/api/v1/industrial-parks').set(auth(managerToken)).send(parkPayload('AUTH-DENIED-CREATE')),
      request(app.getHttpServer()).put(`/api/v1/industrial-parks/${target.id}`).set(auth(managerToken)).send({ city: 'Denied city' }),
      request(app.getHttpServer()).delete(`/api/v1/industrial-parks/${target.id}`).set(auth(managerToken)),
    ];
    const deniedResponses = await Promise.all(deniedCalls);
    expect(deniedResponses.map((response) => response.status)).toEqual([403, 403, 403, 403, 403]);
    await expect(prisma.industrialPark.findUniqueOrThrow({ where: { id: target.id } })).resolves.toMatchObject({ city: 'Tehran' });
    await expect(prisma.industrialPark.count({ where: { code: 'AUTH-DENIED-CREATE' } })).resolves.toBe(0);

    const staleActors = await Promise.all([
      prisma.user.create({ data: { phoneNumber: '09123333010', password: 'unused', name: 'Inactive stale admin', role: Role.SUPER_ADMIN, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09123333011', password: 'unused', name: 'Unapproved stale admin', role: Role.SUPER_ADMIN, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09123333012', password: 'unused', name: 'Deleted stale admin', role: Role.SUPER_ADMIN, isApproved: true, isActive: true } }),
    ]);
    const staleTokens = await Promise.all(staleActors.map((user) => jwt.signAsync({ sub: user.id, role: Role.SUPER_ADMIN })));
    await prisma.user.update({ where: { id: staleActors[0].id }, data: { isActive: false } });
    await prisma.user.update({ where: { id: staleActors[1].id }, data: { isApproved: false } });
    await prisma.user.delete({ where: { id: staleActors[2].id } });
    for (const staleToken of staleTokens) {
      const response = await request(app.getHttpServer()).get(`/api/v1/industrial-parks/${target.id}`).set(auth(staleToken));
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
    }
  });

  it('returns 409 and preserves every protected park relation without cascade or scope detachment', async () => {
    const factoryPark = await prisma.industrialPark.create({ data: parkPayload('PROTECT-FACTORY') });
    const factory = await prisma.factory.create({ data: {
      name: 'Protected factory', licenseNumber: 'PROTECT-LICENSE-1', nationalId: '3333333333', activityType: 'Manufacturing',
      address: 'Factory address', phoneNumber: '09124444001', managerId: ownerId, parkId: factoryPark.id,
    } });
    const managerPark = await prisma.industrialPark.create({ data: { ...parkPayload('PROTECT-MANAGER'), managers: { connect: { id: managerAId } } } });
    const announcementPark = await prisma.industrialPark.create({ data: parkPayload('PROTECT-ANNOUNCEMENT') });
    const announcement = await prisma.announcement.create({ data: { title: 'Protected announcement', content: 'Durable content', parkId: announcementPark.id, createdById: adminId } });
    const advertisementPark = await prisma.industrialPark.create({ data: parkPayload('PROTECT-ADVERTISEMENT') });
    const advertisement = await prisma.advertisement.create({ data: {
      title: 'Protected advertisement', categoryId, province: 'Tehran', city: 'Tehran', content: 'Durable advertisement',
      contactInfo: { phone: '09123333000' }, images: [], createdById: adminId, parkId: advertisementPark.id,
    } });
    const guardPark = await prisma.industrialPark.create({ data: parkPayload('PROTECT-GUARD') });
    const guard = await prisma.securityGuard.create({ data: {
      userId: guardId, parkId: guardPark.id, shiftStart: new Date('2026-08-28T06:00:00.000Z'), shiftEnd: new Date('2026-08-28T14:00:00.000Z'),
    } });
    const filePark = await prisma.industrialPark.create({ data: parkPayload('PROTECT-FILE') });
    const fileFactory = await prisma.factory.create({ data: {
      name: 'File factory', licenseNumber: 'PROTECT-LICENSE-2', nationalId: '4444444444', activityType: 'Storage',
      address: 'File factory address', phoneNumber: '09124444002', managerId: ownerId, parkId: filePark.id,
    } });
    const scopedFile = await prisma.scopedFile.create({ data: {
      objectKey: 'park-contract/protected-file.pdf', domain: 'park-contract', originalName: 'protected-file.pdf',
      contentType: 'application/pdf', byteSize: BigInt(128), parkId: filePark.id, factoryId: fileFactory.id, uploadedById: adminId,
    } });
    const feedbackPark = await prisma.industrialPark.create({ data: parkPayload('PROTECT-FEEDBACK') });
    const feedback = await prisma.feedback.create({ data: {
      subject: 'Protected feedback', body: 'Feedback remains scoped to its park.', recipientParkId: feedbackPark.id, senderId: adminId,
    } });

    const fixtures = [
      { name: 'factory', parkId: factoryPark.id, relation: () => prisma.factory.findUnique({ where: { id: factory.id } }), databaseRestricts: true },
      { name: 'manager', parkId: managerPark.id, relation: () => prisma.industrialPark.findFirst({ where: { id: managerPark.id, managers: { some: { id: managerAId } } } }), databaseRestricts: false },
      { name: 'announcement', parkId: announcementPark.id, relation: () => prisma.announcement.findUnique({ where: { id: announcement.id } }), databaseRestricts: true },
      { name: 'advertisement', parkId: advertisementPark.id, relation: () => prisma.advertisement.findUnique({ where: { id: advertisement.id } }), databaseRestricts: true },
      { name: 'guard', parkId: guardPark.id, relation: () => prisma.securityGuard.findUnique({ where: { id: guard.id } }), databaseRestricts: true },
      { name: 'scoped file', parkId: filePark.id, relation: () => prisma.scopedFile.findUnique({ where: { id: scopedFile.id } }), databaseRestricts: true },
      { name: 'feedback', parkId: feedbackPark.id, relation: () => prisma.feedback.findUnique({ where: { id: feedback.id } }), databaseRestricts: true },
    ];

    for (const fixture of fixtures) {
      const response = await request(app.getHttpServer()).delete(`/api/v1/industrial-parks/${fixture.parkId}`).set(auth());
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
      await expect(prisma.industrialPark.findUnique({ where: { id: fixture.parkId } })).resolves.not.toBeNull();
      await expect(fixture.relation()).resolves.not.toBeNull();
      await expect(prisma.auditLog.count({ where: { action: 'PARK_DELETED', entityId: fixture.parkId } })).resolves.toBe(0);
      if (fixture.databaseRestricts) {
        await expect(prisma.industrialPark.delete({ where: { id: fixture.parkId } })).rejects.toMatchObject({ code: 'P2003' });
        await expect(fixture.relation()).resolves.not.toBeNull();
      }
    }
  });

  it('rolls back create, update, and delete when the exact transactional audit cannot commit', async () => {
    const updateTarget = await prisma.industrialPark.create({ data: parkPayload('ROLLBACK-UPDATE') });
    const deleteTarget = await prisma.industrialPark.create({ data: parkPayload('ROLLBACK-DELETE') });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "test_fail_park_crud_audit_fn"() RETURNS trigger AS $$
      BEGIN
        IF NEW."action" IN ('PARK_CREATED', 'PARK_UPDATED', 'PARK_DELETED') THEN
          RAISE EXCEPTION 'intentional park CRUD audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "test_fail_park_crud_audit"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "test_fail_park_crud_audit_fn"()
    `);

    try {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/industrial-parks')
        .set(auth())
        .set('X-Request-ID', 'park-rollback-create')
        .send(parkPayload('ROLLBACK-CREATE'));
      const updateResponse = await request(app.getHttpServer())
        .put(`/api/v1/industrial-parks/${updateTarget.id}`)
        .set(auth())
        .set('X-Request-ID', 'park-rollback-update')
        .send({ city: 'Mutated city' });
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/v1/industrial-parks/${deleteTarget.id}`)
        .set(auth())
        .set('X-Request-ID', 'park-rollback-delete');

      for (const [response, requestId] of [
        [createResponse, 'park-rollback-create'],
        [updateResponse, 'park-rollback-update'],
        [deleteResponse, 'park-rollback-delete'],
      ] as const) {
        expect(response.status).toBe(500);
        expect(response.headers['x-request-id']).toBe(requestId);
        expect(response.body).toEqual({ statusCode: 500, message: 'Internal server error', code: 'INTERNAL_ERROR', correlationId: requestId });
      }
      await expect(prisma.industrialPark.count({ where: { code: 'ROLLBACK-CREATE' } })).resolves.toBe(0);
      await expect(prisma.industrialPark.findUniqueOrThrow({ where: { id: updateTarget.id } })).resolves.toMatchObject({ city: 'Tehran' });
      await expect(prisma.industrialPark.findUnique({ where: { id: deleteTarget.id } })).resolves.not.toBeNull();
      await expect(prisma.auditLog.count({ where: { entity: 'IndustrialPark', entityId: { in: [updateTarget.id, deleteTarget.id] } } })).resolves.toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "test_fail_park_crud_audit" ON "AuditLog"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "test_fail_park_crud_audit_fn"()');
    }
  });
});
