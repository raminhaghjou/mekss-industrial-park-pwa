import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { OtpPurpose, Role } from '@prisma/client';
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

const parkData = (id: string, code: string) => ({
  id,
  code,
  name: `${code} park`,
  province: 'Tehran',
  city: 'Tehran',
  address: `${code} address`,
  phoneNumber: '02111111111',
  guardPhone: '02122222222',
});

const wait = (milliseconds: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const expectNoCredentials = (value: unknown) => {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toMatch(/"password"|"sessionVersion"|"bootstrapKey"|"refreshTokens"|"otpChallenges"/);
};

describe('Safe transactional user administration lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let adminAId: string;
  let adminBId: string;
  let adminAToken: string;
  let adminBToken: string;
  let otherUserToken: string;
  let parkId: string;
  let factoryId: string;
  let originalFactoryOwnerId: string;

  const adminPassword = 'AdminContract123';
  const targetPassword = 'TargetContract123';
  const auth = (token = adminAToken) => ({ Authorization: `Bearer ${token}` });
  const issueCurrentToken = async (userId: string) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
    return jwt.signAsync({ sub: userId, sessionVersion: user.sessionVersion });
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const password = await bcrypt.hash(adminPassword, 4);
    const targetHash = await bcrypt.hash(targetPassword, 4);
    const [adminA, adminB, otherUser, originalOwner] = await Promise.all([
      prisma.user.create({ data: { phoneNumber: '09124444000', password, name: 'User Contract Admin A', role: Role.SUPER_ADMIN, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09124444001', password, name: 'User Contract Admin B', role: Role.SUPER_ADMIN, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09124444002', password: targetHash, name: 'Other Session User', role: Role.EMPLOYEE, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09124444003', password: targetHash, name: 'Original Factory Owner', role: Role.FACTORY_OWNER, isApproved: true, isActive: true } }),
    ]);
    adminAId = adminA.id;
    adminBId = adminB.id;
    originalFactoryOwnerId = originalOwner.id;
    adminAToken = await issueCurrentToken(adminA.id);
    adminBToken = await issueCurrentToken(adminB.id);
    otherUserToken = await issueCurrentToken(otherUser.id);

    const park = await prisma.industrialPark.create({ data: parkData('user-contract-park', 'USER-CONTRACT') });
    parkId = park.id;
    const factory = await prisma.factory.create({
      data: {
        id: 'user-contract-factory',
        name: 'User contract factory',
        licenseNumber: 'USER-CONTRACT-LICENSE',
        nationalId: '1400999001',
        activityType: 'Manufacturing',
        address: 'Factory address',
        phoneNumber: '09125555000',
        managerId: originalOwner.id,
        parkId: park.id,
        isApproved: true,
      },
    });
    factoryId = factory.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns a deterministic repeatable-snapshot list and explicit safe relationship summaries', async () => {
    const createdAt = new Date('2026-08-28T13:00:00.000Z');
    await prisma.user.createMany({ data: [
      { id: 'user-order-a', phoneNumber: '09124444010', password: 'secret-a', name: 'Lifecycle Order A', role: Role.EMPLOYEE, createdAt },
      { id: 'user-order-b', phoneNumber: '09124444011', password: 'secret-b', name: 'Lifecycle Order B', role: Role.EMPLOYEE, createdAt },
    ] });

    const first = await request(app.getHttpServer()).get('/api/v1/users?page=1&pageSize=1&search=Lifecycle%20Order').set(auth());
    const second = await request(app.getHttpServer()).get('/api/v1/users?page=2&pageSize=1&search=Lifecycle%20Order').set(auth());
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect([first.body.items[0].id, second.body.items[0].id]).toEqual(['user-order-a', 'user-order-b']);
    expect(first.body.items[0].relationshipSummary).toMatchObject({ managedFactories: 0, managedParks: 0, notifications: 0 });
    expectNoCredentials(first.body);

    const detail = await request(app.getHttpServer()).get('/api/v1/users/user-order-a').set(auth());
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ id: 'user-order-a', managedFactories: [], managedParks: [], employeeOfFactory: null });
    expectNoCredentials(detail.body);
  });

  it('normalizes unique identities and enforces role-compatible durable assignments', async () => {
    const managerResponse = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth())
      .set('X-Request-ID', 'user-manager-create')
      .send({
        phoneNumber: '+98 912 444 4020',
        name: '  Assigned Manager  ',
        password: 'ManagerPassword123',
        email: ' MANAGER@Example.COM ',
        username: ' Assigned.Manager ',
        nationalId: ' 1234567890 ',
        role: Role.PARK_MANAGER,
        isApproved: true,
        managedParkIds: [parkId],
      });
    expect(managerResponse.status).toBe(201);
    expect(managerResponse.body).toMatchObject({
      phoneNumber: '09124444020', name: 'Assigned Manager', email: 'manager@example.com', username: 'assigned.manager',
      nationalId: '1234567890', role: Role.PARK_MANAGER, managedParks: [{ id: parkId }],
    });
    expectNoCredentials(managerResponse.body);
    const managerId = managerResponse.body.id as string;

    const publicRegistration = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      phoneNumber: '09124444026', name: 'Canonical Registration', password: 'Registration123', email: ' Public@Example.COM ',
    });
    expect(publicRegistration.status).toBe(201);
    expect(publicRegistration.body.user.email).toBe('public@example.com');
    await expect(prisma.user.create({
      data: { phoneNumber: '09124444027', password: 'unused', name: 'Noncanonical Writer', role: Role.EMPLOYEE, email: 'Mixed@Example.COM' },
    })).rejects.toBeDefined();

    const incompatible = await request(app.getHttpServer())
      .patch(`/api/v1/users/${managerId}`)
      .set(auth())
      .send({ role: Role.GOVERNMENT_OFFICIAL });
    expect(incompatible.status).toBe(409);
    await expect(prisma.user.findUniqueOrThrow({ where: { id: managerId }, select: { role: true } })).resolves.toEqual({ role: Role.PARK_MANAGER });

    const cleared = await request(app.getHttpServer())
      .patch(`/api/v1/users/${managerId}`)
      .set(auth())
      .send({ role: Role.GOVERNMENT_OFFICIAL, managedParkIds: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toMatchObject({ role: Role.GOVERNMENT_OFFICIAL, managedParks: [] });

    const ownerResponse = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth())
      .send({
        phoneNumber: '09124444021', name: 'Replacement Owner', password: 'OwnerPassword123', role: Role.FACTORY_OWNER,
        isApproved: true, managedFactoryIds: [factoryId],
      });
    expect(ownerResponse.status).toBe(201);
    expect(ownerResponse.body.managedFactories).toEqual([expect.objectContaining({ id: factoryId })]);
    await expect(prisma.factory.findUniqueOrThrow({ where: { id: factoryId }, select: { managerId: true } })).resolves.toEqual({ managerId: ownerResponse.body.id });
    await expect(prisma.user.findUniqueOrThrow({ where: { id: originalFactoryOwnerId }, select: { _count: { select: { managedFactories: true } } } })).resolves.toEqual({ _count: { managedFactories: 0 } });

    const employeeResponse = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth())
      .send({
        phoneNumber: '09124444022', name: 'Assigned Employee', password: 'EmployeePassword123', role: Role.EMPLOYEE,
        isApproved: true, employeeOfFactoryId: factoryId,
      });
    expect(employeeResponse.status).toBe(201);
    expect(employeeResponse.body.employeeOfFactory).toMatchObject({ id: factoryId });

    const invalidAssignment = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth())
      .send({
        phoneNumber: '09124444023', name: 'Invalid Assignment', password: 'InvalidPassword123',
        role: Role.SECURITY_GUARD, managedParkIds: [parkId],
      });
    expect(invalidAssignment.status).toBe(400);

    const duplicateCalls = ['09124444024', '09124444025'].map((phoneNumber) => request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth())
      .send({ phoneNumber, name: 'Unique Race', password: 'UniquePassword123', email: 'race@example.com', role: Role.EMPLOYEE }));
    const duplicateResponses = await Promise.all(duplicateCalls);
    expect(duplicateResponses.map(({ status }) => status).sort()).toEqual([201, 409]);
    await expect(prisma.user.count({ where: { email: 'race@example.com' } })).resolves.toBe(1);
    await expect(prisma.auditLog.count({ where: { action: 'USER_CREATED', entity: 'User', changes: { path: ['role'], equals: Role.EMPLOYEE } } })).resolves.toBeGreaterThanOrEqual(1);
  });

  it('treats repeated state and identical updates as no-ops without duplicate audits', async () => {
    const target = await prisma.user.create({
      data: { phoneNumber: '09124444030', password: 'unused', name: 'No Op User', role: Role.EMPLOYEE, isApproved: true, isActive: true },
    });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: { sessionVersion: true, updatedAt: true } });

    const update = await request(app.getHttpServer()).patch(`/api/v1/users/${target.id}`).set(auth()).send({ name: 'No Op User' });
    const activate = await request(app.getHttpServer()).post(`/api/v1/users/${target.id}/activate`).set(auth());
    expect(update.status).toBe(200);
    expect(activate.status).toBe(201);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: { sessionVersion: true, updatedAt: true } });
    expect(after).toEqual(before);
    await expect(prisma.auditLog.count({ where: { entity: 'User', entityId: target.id } })).resolves.toBe(0);
  });

  it('revokes stale access and refresh sessions without resurrection while preserving other users', async () => {
    const targetHash = await bcrypt.hash(targetPassword, 4);
    const target = await prisma.user.create({
      data: { phoneNumber: '09124444040', password: targetHash, name: 'Session Target', role: Role.EMPLOYEE, isApproved: true, isActive: true },
    });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phoneNumber: target.phoneNumber, password: targetPassword });
    expect(login.status).toBe(200);
    const staleAccess = login.body.accessToken as string;
    const staleRefresh = login.body.refreshToken as string;
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(staleAccess))).status).toBe(200);

    expect((await request(app.getHttpServer()).post(`/api/v1/users/${target.id}/deactivate`).set(auth())).status).toBe(201);
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(staleAccess))).status).toBe(401);
    expect((await request(app.getHttpServer()).post(`/api/v1/users/${target.id}/activate`).set(auth())).status).toBe(201);
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(staleAccess))).status).toBe(401);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: staleRefresh })).status).toBe(401);
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(otherUserToken))).status).toBe(200);

    const freshLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phoneNumber: target.phoneNumber, password: targetPassword });
    expect(freshLogin.status).toBe(200);
    const refreshAuditBefore = await prisma.auditLog.count({ where: { userId: target.id, action: 'REFRESH_TOKEN_ROTATED' } });
    const rotations = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: freshLogin.body.refreshToken }),
      request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: freshLogin.body.refreshToken }),
    ]);
    expect(rotations.map(({ status }) => status).sort()).toEqual([200, 401]);
    const rotated = rotations.find(({ status }) => status === 200);
    expect(rotated).toBeDefined();
    await expect(prisma.auditLog.count({ where: { userId: target.id, action: 'REFRESH_TOKEN_ROTATED' } })).resolves.toBe(refreshAuditBefore + 1);
    const freshAccess = rotated?.body.accessToken as string;
    const freshRefresh = rotated?.body.refreshToken as string;
    const replacementPassword = ' NewPassword123 ';
    const reset = await request(app.getHttpServer())
      .post(`/api/v1/users/${target.id}/reset-password`)
      .set(auth())
      .send({ newPassword: replacementPassword });
    expect(reset.status).toBe(201);
    expectNoCredentials(reset.body);
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(freshAccess))).status).toBe(401);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: freshRefresh })).status).toBe(401);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phoneNumber: target.phoneNumber, password: targetPassword })).status).toBe(401);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phoneNumber: target.phoneNumber, password: replacementPassword })).status).toBe(200);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phoneNumber: target.phoneNumber, password: replacementPassword.trim() })).status).toBe(401);
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(otherUserToken))).status).toBe(200);
  });

  it('serializes login and refresh issuance against password reset and deactivation', async () => {
    const targetHash = await bcrypt.hash(targetPassword, 4);
    const target = await prisma.user.create({
      data: { phoneNumber: '09124444041', password: targetHash, name: 'Issuance Race Target', role: Role.EMPLOYEE, isApproved: true, isActive: true },
    });
    const installDelayTrigger = async () => {
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION "test_delay_target_refresh_fn"() RETURNS trigger AS $$
        BEGIN
          IF NEW."userId" = '${target.id}' THEN PERFORM pg_sleep(1); END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "test_delay_target_refresh"
        BEFORE INSERT ON "RefreshToken"
        FOR EACH ROW EXECUTE FUNCTION "test_delay_target_refresh_fn"()
      `);
    };
    const removeDelayTrigger = async () => {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "test_delay_target_refresh" ON "RefreshToken"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "test_delay_target_refresh_fn"()');
    };

    await installDelayTrigger();
    let racedLogin: request.Response;
    let reset: request.Response;
    try {
      const loginPromise = request(app.getHttpServer()).post('/api/v1/auth/login')
        .send({ phoneNumber: target.phoneNumber, password: targetPassword }).then((response) => response);
      await wait(150);
      const resetPromise = request(app.getHttpServer()).post(`/api/v1/users/${target.id}/reset-password`)
        .set(auth()).send({ newPassword: 'RaceReplacement123' }).then((response) => response);
      [racedLogin, reset] = await Promise.all([loginPromise, resetPromise]);
    } finally {
      await removeDelayTrigger();
    }
    expect(racedLogin.status).toBe(200);
    expect(reset.status).toBe(201);
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(racedLogin.body.accessToken))).status).toBe(401);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: racedLogin.body.refreshToken })).status).toBe(401);

    const currentLogin = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ phoneNumber: target.phoneNumber, password: 'RaceReplacement123' });
    expect(currentLogin.status).toBe(200);
    await installDelayTrigger();
    let racedRefresh: request.Response;
    let deactivated: request.Response;
    try {
      const refreshPromise = request(app.getHttpServer()).post('/api/v1/auth/refresh')
        .send({ refreshToken: currentLogin.body.refreshToken }).then((response) => response);
      await wait(150);
      const deactivatePromise = request(app.getHttpServer()).post(`/api/v1/users/${target.id}/deactivate`)
        .set(auth()).then((response) => response);
      [racedRefresh, deactivated] = await Promise.all([refreshPromise, deactivatePromise]);
    } finally {
      await removeDelayTrigger();
    }
    expect(racedRefresh.status).toBe(200);
    expect(deactivated.status).toBe(201);
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(racedRefresh.body.accessToken))).status).toBe(401);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: racedRefresh.body.refreshToken })).status).toBe(401);
    expect((await request(app.getHttpServer()).post(`/api/v1/users/${target.id}/activate`).set(auth())).status).toBe(201);
  });

  it('rejects every old-phone auth race and revokes old identity material after a phone change', async () => {
    const oldPhone = '09124444042';
    const newPhone = '09124444043';
    const otp = '654321';
    const racedReplacementPassword = 'RacedReplacement123';
    const targetHash = await bcrypt.hash(targetPassword, 4);
    const otpHash = await bcrypt.hash(otp, 4);
    const target = await prisma.user.create({
      data: { phoneNumber: oldPhone, password: targetHash, name: 'Phone Identity Race Target', role: Role.EMPLOYEE, isApproved: true, isActive: true },
    });
    const oldSession = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ phoneNumber: oldPhone, password: targetPassword });
    expect(oldSession.status).toBe(200);
    const challenges = await Promise.all([
      prisma.otpChallenge.create({
        data: { phoneNumber: oldPhone, userId: target.id, purpose: OtpPurpose.LOGIN, codeHash: otpHash, expiresAt: new Date(Date.now() + 60_000) },
      }),
      prisma.otpChallenge.create({
        data: { phoneNumber: oldPhone, userId: target.id, purpose: OtpPurpose.PASSWORD_RESET, codeHash: otpHash, expiresAt: new Date(Date.now() + 60_000) },
      }),
    ]);

    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "test_delay_phone_change_fn"() RETURNS trigger AS $$
      BEGIN
        IF NEW."id" = '${target.id}' AND NEW."phoneNumber" IS DISTINCT FROM OLD."phoneNumber" THEN
          PERFORM pg_sleep(2);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "test_delay_phone_change"
      BEFORE UPDATE ON "User"
      FOR EACH ROW EXECUTE FUNCTION "test_delay_phone_change_fn"()
    `);

    let changed: request.Response;
    let racedPasswordLogin: request.Response;
    let racedOtpLogin: request.Response;
    let racedForgot: request.Response;
    let racedReset: request.Response;
    try {
      const changePromise = request(app.getHttpServer()).patch(`/api/v1/users/${target.id}`)
        .set(auth()).send({ phoneNumber: newPhone }).then((response) => response);
      await wait(150);
      const passwordPromise = request(app.getHttpServer()).post('/api/v1/auth/login')
        .send({ phoneNumber: oldPhone, password: targetPassword }).then((response) => response);
      const otpPromise = request(app.getHttpServer()).post('/api/v1/auth/otp/verify')
        .send({ phoneNumber: oldPhone, otp }).then((response) => response);
      const forgotPromise = request(app.getHttpServer()).post('/api/v1/auth/password/forgot')
        .send({ phoneNumber: oldPhone }).then((response) => response);
      const resetPromise = request(app.getHttpServer()).post('/api/v1/auth/password/reset')
        .send({ phoneNumber: oldPhone, otp, newPassword: racedReplacementPassword }).then((response) => response);
      [changed, racedPasswordLogin, racedOtpLogin, racedForgot, racedReset] = await Promise.all([
        changePromise, passwordPromise, otpPromise, forgotPromise, resetPromise,
      ]);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "test_delay_phone_change" ON "User"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "test_delay_phone_change_fn"()');
    }

    expect(changed.status).toBe(200);
    expect(changed.body.phoneNumber).toBe(newPhone);
    expect(racedPasswordLogin.status).toBe(401);
    expect(racedOtpLogin.status).toBe(401);
    expect(racedForgot.status).toBe(404);
    expect(racedReset.status).toBe(401);
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(oldSession.body.accessToken))).status).toBe(401);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: oldSession.body.refreshToken })).status).toBe(401);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phoneNumber: oldPhone, password: targetPassword })).status).toBe(401);

    const persistedChallenges = await prisma.otpChallenge.findMany({
      where: { id: { in: challenges.map(({ id }) => id) } },
      select: { purpose: true, consumedAt: true },
    });
    expect(persistedChallenges).toHaveLength(2);
    expect(persistedChallenges).toEqual(expect.arrayContaining([
      expect.objectContaining({ purpose: OtpPurpose.LOGIN, consumedAt: expect.any(Date) }),
      expect.objectContaining({ purpose: OtpPurpose.PASSWORD_RESET, consumedAt: expect.any(Date) }),
    ]));
    await expect(prisma.otpChallenge.count({ where: { userId: target.id, phoneNumber: oldPhone, consumedAt: null } })).resolves.toBe(0);

    const newSession = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ phoneNumber: newPhone, password: targetPassword });
    expect(newSession.status).toBe(200);
    expect(newSession.body.user.phoneNumber).toBe(newPhone);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ phoneNumber: newPhone, password: racedReplacementPassword })).status).toBe(401);
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(newSession.body.accessToken))).status).toBe(200);
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(otherUserToken))).status).toBe(200);
  });

  it('blocks acting-account loss and serializes cross-deactivation to preserve an eligible super-admin', async () => {
    const selfDeactivate = await request(app.getHttpServer()).post(`/api/v1/users/${adminAId}/deactivate`).set(auth(adminAToken));
    const selfDemote = await request(app.getHttpServer()).patch(`/api/v1/users/${adminAId}`).set(auth(adminAToken)).send({ role: Role.EMPLOYEE });
    const selfUnapprove = await request(app.getHttpServer()).patch(`/api/v1/users/${adminAId}`).set(auth(adminAToken)).send({ isApproved: false });
    const selfDelete = await request(app.getHttpServer()).delete(`/api/v1/users/${adminAId}`).set(auth(adminAToken));
    expect([selfDeactivate.status, selfDemote.status, selfUnapprove.status, selfDelete.status]).toEqual([403, 403, 403, 403]);

    const concurrent = await Promise.all([
      request(app.getHttpServer()).post(`/api/v1/users/${adminBId}/deactivate`).set(auth(adminAToken)),
      request(app.getHttpServer()).post(`/api/v1/users/${adminAId}/deactivate`).set(auth(adminBToken)),
    ]);
    expect(concurrent.map(({ status }) => status).sort()).toEqual([201, 403]);
    const admins = await prisma.user.findMany({ where: { id: { in: [adminAId, adminBId] } }, select: { id: true, isActive: true, isApproved: true, role: true } });
    expect(admins.filter((user) => user.role === Role.SUPER_ADMIN && user.isActive && user.isApproved)).toHaveLength(1);
    await expect(prisma.auditLog.count({ where: { action: 'USER_DEACTIVATED', entityId: { in: [adminAId, adminBId] } } })).resolves.toBe(1);

    await prisma.user.updateMany({ where: { id: { in: [adminAId, adminBId] } }, data: { role: Role.SUPER_ADMIN, isActive: true, isApproved: true } });
    adminAToken = await issueCurrentToken(adminAId);
    adminBToken = await issueCurrentToken(adminBId);
  });

  it('blocks every protected business relation, maps FK races to conflict, and deletes auth artifacts only when eligible', async () => {
    const targetHash = await bcrypt.hash(targetPassword, 4);
    const target = await prisma.user.create({
      data: { phoneNumber: '09124444050', password: targetHash, name: 'Protected Delete Target', role: Role.EMPLOYEE, isApproved: true, isActive: true },
    });
    const notification = await prisma.notification.create({ data: { userId: target.id, title: 'Retained notification', body: 'Business-visible notification' } });
    const blocked = await request(app.getHttpServer()).delete(`/api/v1/users/${target.id}`).set(auth());
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    await expect(prisma.user.count({ where: { id: target.id } })).resolves.toBe(1);
    await expect(prisma.auditLog.count({ where: { action: 'USER_DELETED', entityId: target.id } })).resolves.toBe(0);

    await prisma.notification.delete({ where: { id: notification.id } });
    const lateAnnouncementId = `late-${target.id}`;
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "test_late_user_relation_fn"() RETURNS trigger AS $$
      BEGIN
        IF OLD."id" = '${target.id}' THEN
          INSERT INTO "Announcement" ("id", "title", "content", "updatedAt", "createdById")
          VALUES ('${lateAnnouncementId}', 'Late relation', 'Inserted after delete preflight', CURRENT_TIMESTAMP, OLD."id");
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "test_late_user_relation"
      BEFORE DELETE ON "User"
      FOR EACH ROW EXECUTE FUNCTION "test_late_user_relation_fn"()
    `);
    try {
      const racedDelete = await request(app.getHttpServer()).delete(`/api/v1/users/${target.id}`).set(auth());
      expect(racedDelete.status).toBe(409);
      expect(racedDelete.body).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
      await expect(prisma.user.count({ where: { id: target.id } })).resolves.toBe(1);
      await expect(prisma.announcement.count({ where: { id: lateAnnouncementId } })).resolves.toBe(0);
      await expect(prisma.auditLog.count({ where: { action: 'USER_DELETED', entityId: target.id } })).resolves.toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "test_late_user_relation" ON "User"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "test_late_user_relation_fn"()');
    }

    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phoneNumber: target.phoneNumber, password: targetPassword });
    expect(login.status).toBe(200);
    const deleted = await request(app.getHttpServer()).delete(`/api/v1/users/${target.id}`).set(auth());
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: target.id, deleted: true });
    await expect(prisma.user.count({ where: { id: target.id } })).resolves.toBe(0);
    await expect(prisma.refreshToken.count({ where: { userId: target.id } })).resolves.toBe(0);
    await expect(prisma.auditLog.count({ where: { entityId: target.id, userId: null } })).resolves.toBeGreaterThanOrEqual(1);
    await expect(prisma.auditLog.count({ where: { action: 'USER_DELETED', entityId: target.id } })).resolves.toBe(1);
  });

  it('enforces authorization and rolls back the user mutation when its exact-once audit fails', async () => {
    const unauthorizedRead = await request(app.getHttpServer()).get('/api/v1/users').set(auth(otherUserToken));
    expect(unauthorizedRead.status).toBe(403);

    const target = await prisma.user.create({
      data: { phoneNumber: '09124444060', password: 'unused', name: 'Rollback User', role: Role.EMPLOYEE, isApproved: true, isActive: true },
    });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "test_fail_user_audit_fn"() RETURNS trigger AS $$
      BEGIN
        IF NEW."action" = 'USER_UPDATED' AND NEW."entityId" = '${target.id}' THEN
          RAISE EXCEPTION 'intentional user audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "test_fail_user_audit"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "test_fail_user_audit_fn"()
    `);

    try {
      const failed = await request(app.getHttpServer())
        .patch(`/api/v1/users/${target.id}`)
        .set(auth())
        .set('X-Request-ID', 'user-rollback')
        .send({ name: 'Must Roll Back' });
      expect(failed.status).toBe(500);
      expect(failed.body).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR', correlationId: 'user-rollback' });
      await expect(prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: { name: true } })).resolves.toEqual({ name: 'Rollback User' });
      await expect(prisma.auditLog.count({ where: { action: 'USER_UPDATED', entityId: target.id } })).resolves.toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "test_fail_user_audit" ON "AuditLog"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "test_fail_user_audit_fn"()');
    }
  });
});
