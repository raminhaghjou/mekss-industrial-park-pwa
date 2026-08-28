import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AdvertisementStatus,
  CargoType,
  EmergencySeverity,
  RequestPriority,
  RequestType,
  Role,
  VehicleType,
} from '@prisma/client';
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

describe('Management transaction foundation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let actorId: string;
  let advertisementId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const actor = await prisma.user.create({
      data: {
        phoneNumber: '09121111111',
        password: 'not-used-by-this-test',
        name: 'Integration Super Admin',
        role: Role.SUPER_ADMIN,
        isApproved: true,
        isActive: true,
      },
    });
    actorId = actor.id;
    accessToken = await app.get(JwtService).signAsync({ sub: actor.id });

    const category = await prisma.advertisementCategoryDef.create({
      data: { key: 'INTEGRATION_OTHER', label: 'Integration other', isActive: true },
    });
    const park = await prisma.industrialPark.create({
      data: {
        id: 'moderation-foundation-park', code: 'MODERATION-FOUNDATION', name: 'Moderation Foundation Park',
        province: 'Tehran', city: 'Tehran', address: 'Integration test address',
        phoneNumber: '02133333333', guardPhone: '02144444444',
      },
    });
    const advertisement = await prisma.advertisement.create({
      data: {
        title: 'Concurrent moderation fixture',
        categoryId: category.id,
        province: 'Tehran',
        city: 'Tehran',
        content: 'A pending advertisement used only in an isolated integration schema.',
        contactInfo: { phone: '09121111111' },
        images: [],
        parkId: park.id,
        createdById: actor.id,
      },
    });
    advertisementId = advertisement.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('rolls back the business mutation when the transactional audit insert fails', async () => {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "test_fail_park_audit_fn"() RETURNS trigger AS $$
      BEGIN
        IF NEW."action" = 'PARK_CREATED' THEN
          RAISE EXCEPTION 'intentional integration audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "test_fail_park_audit"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "test_fail_park_audit_fn"()
    `);

    try {
      const response = await request(app.getHttpServer())
        .post('/api/v1/industrial-parks')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Request-ID', 'rollback-request')
        .send({
          code: 'ROLLBACK-PARK',
          name: 'Rollback Park',
          province: 'Tehran',
          city: 'Tehran',
          address: 'Integration test address',
          phoneNumber: '02111111111',
          guardPhone: '02122222222',
        });

      expect(response.status).toBe(500);
      expect(response.headers['x-request-id']).toBe('rollback-request');
      expect(response.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        correlationId: 'rollback-request',
      });
      await expect(prisma.industrialPark.count({ where: { code: 'ROLLBACK-PARK' } })).resolves.toBe(0);
      await expect(prisma.auditLog.count({ where: { action: 'PARK_CREATED', correlationId: 'rollback-request' } })).resolves.toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "test_fail_park_audit" ON "AuditLog"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "test_fail_park_audit_fn"()');
    }
  });

  it('commits one concurrent moderation transition and the winning request correlation id', async () => {
    const requestIds = ['moderation-request-a', 'moderation-request-b'];
    const calls = requestIds.map((requestId) => request(app.getHttpServer())
      .post(`/api/v1/advertisements/${advertisementId}/approve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Request-ID', requestId)
      .send({ approved: true }));

    const responses = await Promise.all(calls);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);

    const winningResponse = responses.find(({ status }) => status === 201);
    const losingResponse = responses.find(({ status }) => status === 409);
    expect(winningResponse).toBeDefined();
    expect(losingResponse).toBeDefined();
    expect(requestIds).toContain(winningResponse?.headers['x-request-id']);
    expect(losingResponse?.body).toMatchObject({ statusCode: 409, code: 'CONFLICT' });

    const advertisement = await prisma.advertisement.findUniqueOrThrow({ where: { id: advertisementId } });
    expect(advertisement).toMatchObject({
      status: AdvertisementStatus.APPROVED,
      isApproved: true,
      moderatedById: actorId,
    });

    const audits = await prisma.auditLog.findMany({
      where: { action: 'ADVERTISEMENT_APPROVED', entity: 'Advertisement', entityId: advertisementId },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].correlationId).toBe(winningResponse?.headers['x-request-id']);
    expect(audits[0].correlationId).not.toBe(losingResponse?.headers['x-request-id']);
  });
});

describe('Scoped dashboard contract (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let managerAToken: string;
  let managerBToken: string;
  let emptyManagerToken: string;
  let ownerAToken: string;
  let securityToken: string;
  let governmentToken: string;
  let managerAId: string;
  let managerBId: string;
  let parkAId: string;
  let parkBId: string;
  let factoryAId: string;
  let requestAId: string;
  let requestBId: string;
  let gatePassAId: string;
  let gatePassBId: string;
  let advertisementAId: string;
  let advertisementBId: string;
  let globalBaseline: {
    factories: number;
    gatePasses: number;
    invoices: number;
    requests: number;
    openEmergencies: number;
    pendingGatePasses: number;
    pendingRequests: number;
    pendingAdvertisements: number;
  };

  const dashboard = (token: string, requestId: string) => request(app.getHttpServer())
    .get('/api/v1/analytics/dashboard')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Request-ID', requestId);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const [
      factories, gatePasses, invoices, requests, openEmergencies,
      pendingGatePasses, pendingRequests, pendingAdvertisements,
    ] = await Promise.all([
      prisma.factory.count(),
      prisma.gatePass.count(),
      prisma.invoice.count(),
      prisma.request.count(),
      prisma.emergencyAlert.count({ where: { status: { not: 'RESOLVED' } } }),
      prisma.gatePass.count({ where: { status: 'PENDING' } }),
      prisma.request.count({ where: { status: 'PENDING' } }),
      prisma.advertisement.count({ where: { status: AdvertisementStatus.PENDING } }),
    ]);
    globalBaseline = {
      factories, gatePasses, invoices, requests, openEmergencies,
      pendingGatePasses, pendingRequests, pendingAdvertisements,
    };

    const [admin, managerA, managerB, emptyManager, ownerA, ownerB, securityGuard, governmentOfficial] = await Promise.all([
      prisma.user.create({ data: { phoneNumber: '09121111200', password: 'unused', name: 'Dashboard Admin', role: Role.SUPER_ADMIN, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09121111112', password: 'unused', name: 'Manager A', role: Role.PARK_MANAGER, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09121111113', password: 'unused', name: 'Manager B', role: Role.PARK_MANAGER, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09121111114', password: 'unused', name: 'Empty Manager', role: Role.PARK_MANAGER, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09121111115', password: 'unused', name: 'Owner A', role: Role.FACTORY_OWNER, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09121111116', password: 'unused', name: 'Owner B', role: Role.FACTORY_OWNER, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09121111117', password: 'unused', name: 'Security Guard', role: Role.SECURITY_GUARD, isApproved: true, isActive: true } }),
      prisma.user.create({ data: { phoneNumber: '09121111118', password: 'unused', name: 'Government Official', role: Role.GOVERNMENT_OFFICIAL, isApproved: true, isActive: true } }),
    ]);
    managerAId = managerA.id;
    managerBId = managerB.id;
    [adminToken, managerAToken, managerBToken, emptyManagerToken, ownerAToken, securityToken, governmentToken] = await Promise.all([
      jwt.signAsync({ sub: admin.id }),
      jwt.signAsync({ sub: managerA.id }),
      jwt.signAsync({ sub: managerB.id }),
      jwt.signAsync({ sub: emptyManager.id }),
      jwt.signAsync({ sub: ownerA.id }),
      jwt.signAsync({ sub: securityGuard.id }),
      jwt.signAsync({ sub: governmentOfficial.id }),
    ]);

    const parkA = await prisma.industrialPark.create({
      data: {
        code: 'DASH-A', name: 'Dashboard Park A', province: 'Tehran', city: 'Tehran', address: 'Park A address',
        phoneNumber: '02130000001', guardPhone: '02130000002', managers: { connect: [{ id: managerA.id }] },
      },
    });
    parkAId = parkA.id;
    const parkB = await prisma.industrialPark.create({
      data: {
        code: 'DASH-B', name: 'Dashboard Park B', province: 'Alborz', city: 'Karaj', address: 'Park B address',
        phoneNumber: '02630000001', guardPhone: '02630000002', managers: { connect: [{ id: managerA.id }, { id: managerB.id }] },
      },
    });
    parkBId = parkB.id;
    await prisma.securityGuard.create({
      data: {
        userId: securityGuard.id,
        parkId: parkA.id,
        shiftStart: new Date('2026-08-28T00:00:00.000Z'),
        shiftEnd: new Date('2026-08-29T00:00:00.000Z'),
        isActive: true,
      },
    });

    const [factoryA, factoryB] = await Promise.all([
      prisma.factory.create({
        data: {
          name: 'Dashboard Factory A', licenseNumber: 'DASH-LICENSE-A', nationalId: '1111111111', activityType: 'Manufacturing',
          address: 'Factory A address', phoneNumber: '09123333331', managerId: ownerA.id, parkId: parkA.id,
        },
      }),
      prisma.factory.create({
        data: {
          name: 'Dashboard Factory B', licenseNumber: 'DASH-LICENSE-B', nationalId: '2222222222', activityType: 'Logistics',
          address: 'Factory B address', phoneNumber: '09123333332', managerId: ownerB.id, parkId: parkB.id,
        },
      }),
    ]);
    factoryAId = factoryA.id;
    const [requestA, requestB, gatePassA, gatePassB, category] = await Promise.all([
      prisma.request.create({
        data: {
          type: RequestType.OTHER, title: 'Urgent park A request', description: 'Scoped dashboard A', data: {}, attachments: [],
          priority: RequestPriority.URGENT, isToParkManager: true, creatorId: ownerA.id, factoryId: factoryA.id,
        },
      }),
      prisma.request.create({
        data: {
          type: RequestType.OTHER, title: 'High park B request', description: 'Scoped dashboard B', data: {}, attachments: [],
          priority: RequestPriority.HIGH, isToParkManager: true, creatorId: ownerB.id, factoryId: factoryB.id,
        },
      }),
      prisma.gatePass.create({
        data: {
          cargoType: CargoType.OTHER, driverName: 'Driver A', driverNationalId: '1234567890', driverPhone: '09124444441',
          vehicleType: VehicleType.TRUCK, licensePlate: 'DASH-A-1', exitDate: new Date('2026-09-01T10:00:00.000Z'),
          factoryId: factoryA.id, createdById: ownerA.id,
        },
      }),
      prisma.gatePass.create({
        data: {
          cargoType: CargoType.OTHER, driverName: 'Driver B', driverNationalId: '0987654321', driverPhone: '09124444442',
          vehicleType: VehicleType.VAN, licensePlate: 'DASH-B-1', exitDate: new Date('2026-09-02T10:00:00.000Z'),
          factoryId: factoryB.id, createdById: ownerB.id,
        },
      }),
      prisma.advertisementCategoryDef.create({ data: { key: 'DASHBOARD_CATEGORY', label: 'Dashboard category' } }),
    ]);
    requestAId = requestA.id;
    requestBId = requestB.id;
    gatePassAId = gatePassA.id;
    gatePassBId = gatePassB.id;

    const [advertisementA, advertisementB] = await Promise.all([
      prisma.advertisement.create({
        data: {
          title: 'Park A advertisement', categoryId: category.id, province: 'Tehran', city: 'Tehran', content: 'Scoped A',
          contactInfo: { phone: '09125555551', privateNote: 'must-not-leak' }, images: ['private-a.jpg'],
          createdById: ownerA.id, parkId: parkA.id,
        },
      }),
      prisma.advertisement.create({
        data: {
          title: 'Park B advertisement', categoryId: category.id, province: 'Alborz', city: 'Karaj', content: 'Scoped B',
          contactInfo: { phone: '09125555552', privateNote: 'must-not-leak' }, images: ['private-b.jpg'],
          createdById: ownerB.id, parkId: parkB.id,
        },
      }),
    ]);
    advertisementAId = advertisementA.id;
    advertisementBId = advertisementB.id;

    await prisma.emergencyAlert.create({
      data: {
        title: 'Global safety alert', description: 'Visible through the established global safety feed',
        severity: EmergencySeverity.HIGH, createdById: admin.id,
      },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('derives global and park-manager metrics, recent items, and actions only from visible records', async () => {
    const [adminResponse, managerAResponse, managerBResponse] = await Promise.all([
      dashboard(adminToken, 'dashboard-admin'),
      dashboard(managerAToken, 'dashboard-manager-a'),
      dashboard(managerBToken, 'dashboard-manager-b'),
    ]);

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body).toMatchObject({
      factories: globalBaseline.factories + 2,
      gatePasses: globalBaseline.gatePasses + 2,
      invoices: globalBaseline.invoices,
      requests: globalBaseline.requests + 2,
      openEmergencies: globalBaseline.openEmergencies + 1,
      pendingWork: {
        gatePasses: globalBaseline.pendingGatePasses + 2,
        requests: globalBaseline.pendingRequests + 2,
        advertisements: globalBaseline.pendingAdvertisements + 2,
      },
    });
    expect(adminResponse.body.capabilities).toEqual(expect.arrayContaining(['manage_factories', 'approve_gate_passes', 'approve_requests']));

    expect(managerAResponse.status).toBe(200);
    expect(managerAResponse.body).toMatchObject({
      factories: 2, gatePasses: 2, invoices: 0, requests: 2, openEmergencies: 1,
      pendingWork: { gatePasses: 2, requests: 2, advertisements: 2 },
    });
    expect(managerBResponse.status).toBe(200);
    expect(managerBResponse.body).toMatchObject({
      factories: 1, gatePasses: 1, invoices: 0, requests: 1, openEmergencies: 1,
      pendingWork: { gatePasses: 1, requests: 1, advertisements: 1 },
    });

    const managerBIds = managerBResponse.body.recentPriorityItems.map(({ id }: { id: string }) => id);
    expect(managerBIds).toEqual(expect.arrayContaining([requestBId, gatePassBId, advertisementBId]));
    expect(managerBIds).not.toEqual(expect.arrayContaining([requestAId, gatePassAId, advertisementAId]));
    expect(JSON.stringify(managerBResponse.body.recentPriorityItems)).not.toMatch(/contactInfo|images|driverNationalId|privateNote|must-not-leak/);
  });

  it('preserves scoped counts and established capabilities for every other authorized dashboard role', async () => {
    const [ownerResponse, securityResponse, governmentResponse] = await Promise.all([
      dashboard(ownerAToken, 'dashboard-owner'),
      dashboard(securityToken, 'dashboard-security'),
      dashboard(governmentToken, 'dashboard-government'),
    ]);

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body).toMatchObject({
      factories: 1, gatePasses: 1, invoices: 0, requests: 1, openEmergencies: 1,
      pendingWork: { gatePasses: 1, requests: 1, advertisements: 0 },
      recentPriorityItems: [],
    });
    expect(ownerResponse.body.capabilities).toEqual(expect.arrayContaining(['create_gate_passes', 'create_requests', 'create_advertisements', 'view_invoices']));

    expect(securityResponse.status).toBe(200);
    expect(securityResponse.body).toMatchObject({
      factories: 1, gatePasses: 1, invoices: 0, requests: 1, openEmergencies: 1,
      pendingWork: { gatePasses: 1, requests: 1, advertisements: 0 },
      recentPriorityItems: [],
    });
    expect(securityResponse.body.capabilities).toEqual(expect.arrayContaining(['verify_gate_passes', 'view_emergencies']));

    expect(governmentResponse.status).toBe(200);
    expect(governmentResponse.body).toMatchObject({
      factories: globalBaseline.factories + 2,
      gatePasses: globalBaseline.gatePasses + 2,
      invoices: globalBaseline.invoices,
      requests: globalBaseline.requests + 2,
      openEmergencies: globalBaseline.openEmergencies + 1,
      pendingWork: {
        gatePasses: globalBaseline.pendingGatePasses + 2,
        requests: globalBaseline.pendingRequests + 2,
        advertisements: 0,
      },
      recentPriorityItems: [],
    });
    expect(governmentResponse.body.capabilities).toEqual(expect.arrayContaining(['view_dashboard', 'view_reports']));
  });

  it('caps recent work at eight items with deterministic tie ordering', async () => {
    const tiedIds = Array.from({ length: 10 }, (_, index) => `dashboard-tie-${index.toString().padStart(2, '0')}`);
    await prisma.request.createMany({
      data: tiedIds.map((id) => ({
        id,
        type: RequestType.OTHER,
        title: `Tied request ${id}`,
        description: 'Deterministic dashboard ordering fixture',
        data: {},
        attachments: [],
        priority: RequestPriority.URGENT,
        isToParkManager: true,
        creatorId: managerAId,
        factoryId: factoryAId,
        createdAt: new Date('2027-01-01T00:00:00.000Z'),
      })),
    });

    try {
      const response = await dashboard(managerAToken, 'dashboard-eight-item-cap');
      expect(response.status).toBe(200);
      expect(response.body.recentPriorityItems).toHaveLength(8);
      expect(response.body.recentPriorityItems.map(({ id }: { id: string }) => id)).toEqual(tiedIds.slice(0, 8));
    } finally {
      await prisma.request.deleteMany({ where: { id: { in: tiedIds } } });
    }
  });

  it('exhaustively preserves Property 3 for every generated subset of the two tenant scopes', async () => {
    const generatedScopes = Array.from({ length: 4 }, (_, mask) => ({
      mask,
      parkA: Boolean(mask & 1),
      parkB: Boolean(mask & 2),
    }));

    for (const scope of generatedScopes) {
      await Promise.all([
        prisma.industrialPark.update({
          where: { id: parkAId },
          data: { managers: scope.parkA ? { connect: [{ id: managerAId }] } : { disconnect: [{ id: managerAId }] } },
        }),
        prisma.industrialPark.update({
          where: { id: parkBId },
          data: { managers: scope.parkB ? { connect: [{ id: managerAId }] } : { disconnect: [{ id: managerAId }] } },
        }),
      ]);

      const response = await dashboard(managerAToken, `dashboard-generated-${scope.mask}`);
      const visibleParkCount = Number(scope.parkA) + Number(scope.parkB);
      const expectedIds = [
        ...(scope.parkA ? [requestAId, gatePassAId, advertisementAId] : []),
        ...(scope.parkB ? [requestBId, gatePassBId, advertisementBId] : []),
      ];

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        factories: visibleParkCount,
        gatePasses: visibleParkCount,
        invoices: 0,
        requests: visibleParkCount,
        openEmergencies: 1,
        pendingWork: {
          gatePasses: visibleParkCount,
          requests: visibleParkCount,
          advertisements: visibleParkCount,
        },
      });
      expect(new Set(response.body.recentPriorityItems.map(({ id }: { id: string }) => id))).toEqual(new Set(expectedIds));
      if (visibleParkCount === 0) {
        expect(response.body.capabilities).not.toContain('manage_factories');
      } else {
        expect(response.body.capabilities).toContain('manage_factories');
      }
    }
  });

  it('drops every out-of-scope value and action immediately after scope narrows', async () => {
    await prisma.industrialPark.update({ where: { id: parkBId }, data: { managers: { disconnect: [{ id: managerAId }] } } });

    const response = await dashboard(managerAToken, 'dashboard-narrowed');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      factories: 1, gatePasses: 1, invoices: 0, requests: 1, openEmergencies: 1,
      pendingWork: { gatePasses: 1, requests: 1, advertisements: 1 },
    });
    const visibleIds = response.body.recentPriorityItems.map(({ id }: { id: string }) => id);
    expect(visibleIds).toEqual(expect.arrayContaining([requestAId, gatePassAId, advertisementAId]));
    expect(visibleIds).not.toEqual(expect.arrayContaining([requestBId, gatePassBId, advertisementBId]));
    expect(response.body.capabilities).toEqual(expect.arrayContaining(['manage_factories', 'approve_gate_passes', 'approve_requests']));
  });

  it('returns truthful empty tenant data and removes tenant mutation actions for an unassigned manager', async () => {
    const response = await dashboard(emptyManagerToken, 'dashboard-empty-scope');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      factories: 0,
      gatePasses: 0,
      invoices: 0,
      requests: 0,
      openEmergencies: 1,
      pendingWork: { gatePasses: 0, requests: 0, advertisements: 0 },
      capabilities: ['view_dashboard', 'view_reports'],
      recentPriorityItems: [],
    });
  });

  it('reconciles stale users before returning dashboard data', async () => {
    await prisma.user.update({ where: { id: managerBId }, data: { isActive: false } });
    const inactiveResponse = await dashboard(managerBToken, 'dashboard-inactive');
    expect(inactiveResponse.status).toBe(401);
    expect(inactiveResponse.body).not.toHaveProperty('factories');

    await prisma.user.update({ where: { id: managerBId }, data: { isActive: true, role: Role.EMPLOYEE } });
    const changedRoleResponse = await dashboard(managerBToken, 'dashboard-role-changed');
    expect(changedRoleResponse.status).toBe(403);
    expect(changedRoleResponse.body).not.toHaveProperty('factories');
  });

  it('returns the stable 5xx envelope instead of partial or fabricated metrics on a real read failure', async () => {
    await prisma.$executeRawUnsafe('ALTER TABLE "Request" RENAME TO "Request_dashboard_unavailable"');
    try {
      const response = await dashboard(adminToken, 'dashboard-database-failure');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        correlationId: 'dashboard-database-failure',
      });
      expect(response.body).not.toHaveProperty('factories');
      expect(response.body).not.toHaveProperty('recentPriorityItems');
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "Request_dashboard_unavailable" RENAME TO "Request"');
    }
  });
});
