import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AdvertisementStatus, Role } from '@prisma/client';

jest.mock('bcrypt', () => ({ hash: jest.fn(async (value: string) => `hashed:${value}`) }));

import { requestContext } from './request-context';
import { ManagementService } from './management.service';

const actor = (role: Role = Role.PARK_MANAGER) => ({ id: 'actor-1', role, phoneNumber: '09120000000' });
const config = { get: jest.fn((_key: string, fallback?: string) => fallback) } as any;
const readTransaction = (prisma: any) => {
  prisma.$transaction = jest.fn((callback, options) => callback(prisma, options));
  return prisma;
};

describe('ManagementService transactional foundation', () => {
  it('keeps the business write and success audit in one transaction and propagates audit failure', async () => {
    const created = { id: 'park-1' };
    const representation = { id: 'park-1', code: 'PARK-1', managers: [], _count: { factories: 0 } };
    const tx = {
      industrialPark: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
        findUniqueOrThrow: jest.fn().mockResolvedValue(representation),
      },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const auditFailure = new Error('audit unavailable');
    const audit = { record: jest.fn().mockRejectedValue(auditFailure) } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(requestContext.run({ correlationId: 'request-atomic-1' }, () => service.createPark(actor(Role.SUPER_ADMIN), {
      code: ' PARK-1 ', name: 'Park', province: 'Province', city: 'City', address: 'Address', phoneNumber: '021000000', guardPhone: '021000001',
    }))).rejects.toBe(auditFailure);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.industrialPark.create).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PARK_CREATED',
      entityId: 'park-1',
      correlationId: 'request-atomic-1',
    }), tx);
  });

  it('allows exactly one pending advertisement transition and audits only that transition', async () => {
    const pending = { id: 'ad-1', parkId: 'park-1', status: AdvertisementStatus.PENDING };
    const approved = { ...pending, status: AdvertisementStatus.APPROVED, isApproved: true };
    const tx = {
      industrialPark: { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]) },
      advertisement: {
        findFirst: jest.fn().mockResolvedValue(pending),
        updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(approved),
      },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.approveAdvertisement(actor(), 'ad-1', true)).resolves.toEqual({ ...approved, contactInfo: {} });
    await expect(service.approveAdvertisement(actor(), 'ad-1', true)).rejects.toBeInstanceOf(ConflictException);

    expect(tx.advertisement.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ad-1', status: AdvertisementStatus.PENDING, parkId: { in: ['park-1'] } },
    }));
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('does not allow a park manager to moderate an advertisement with no park scope', async () => {
    const tx = {
      industrialPark: { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]) },
      advertisement: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const audit = { record: jest.fn() } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.approveAdvertisement(actor(), 'unscoped-ad', true)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.advertisement.findFirst).toHaveBeenCalledWith({
      where: { id: 'unscoped-ad', parkId: { in: ['park-1'] } },
      select: { id: true, parkId: true, status: true },
    });
    expect(tx.advertisement.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('persists every optional factory field accepted by the create DTO', async () => {
    const created = { id: 'factory-1' };
    const prisma = { factory: { create: jest.fn().mockResolvedValue(created) } } as any;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.createFactory(actor(Role.SUPER_ADMIN), {
      name: 'Factory', licenseNumber: 'LICENSE-1', nationalId: '1234567890', activityType: 'Manufacturing',
      address: 'Factory address', phoneNumber: '09120000000', phoneNumber2: '09120000001', landline: '02112345678',
      fax: '02187654321', email: 'factory@example.com', website: 'https://example.com', description: 'Description',
      licenseExpiry: '2027-01-02T00:00:00.000Z', establishedDate: '2020-03-04T00:00:00.000Z', employees: 42,
      parkId: 'park-1', managerId: 'manager-1', status: 'ACTIVE',
    })).resolves.toEqual(created);

    expect(prisma.factory.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      phoneNumber2: '09120000001', landline: '02112345678', fax: '02187654321', employees: 42, status: 'ACTIVE',
      licenseExpiry: new Date('2027-01-02T00:00:00.000Z'), establishedDate: new Date('2020-03-04T00:00:00.000Z'),
    }) });
  });

  it('uses explicit empty predicates for a zero-scope dashboard and keeps the global emergency feed truthful', async () => {
    const prisma = readTransaction({
      factory: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      industrialPark: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      gatePass: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
      invoice: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      request: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
      emergencyAlert: { count: jest.fn().mockResolvedValue(2) },
      advertisement: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    } as any);
    const service = new ManagementService(prisma, { record: jest.fn() } as any, config);

    await expect(service.dashboard(actor())).resolves.toMatchObject({
      factories: 0,
      gatePasses: 0,
      invoices: 0,
      requests: 0,
      openEmergencies: 2,
      pendingWork: { gatePasses: 0, requests: 0, advertisements: 0 },
      capabilities: ['view_dashboard', 'view_reports'],
      recentPriorityItems: [],
    });
    const managerFactoryScope = { park: { is: { managers: { some: { id: 'actor-1' } } } } };
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
    expect(prisma.industrialPark.count).toHaveBeenCalledWith({ where: { managers: { some: { id: 'actor-1' } } } });
    expect(prisma.factory.count).toHaveBeenCalledWith({ where: managerFactoryScope });
    expect(prisma.emergencyAlert.count).toHaveBeenCalledWith({ where: { status: { not: 'RESOLVED' } } });
    for (const call of [...prisma.gatePass.count.mock.calls, ...prisma.gatePass.findMany.mock.calls]) {
      expect(call[0].where.factory).toEqual({ is: managerFactoryScope });
    }
    for (const call of [...prisma.request.count.mock.calls, ...prisma.request.findMany.mock.calls]) {
      expect(call[0].where.factory).toEqual({ is: managerFactoryScope });
    }
    expect(prisma.advertisement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: AdvertisementStatus.PENDING, park: { is: { managers: { some: { id: 'actor-1' } } } } },
      take: 8,
    }));

    await expect(service.report(actor(), 'gatepass')).resolves.toEqual({ type: 'gatepass', byStatus: [] });
    expect(prisma.gatePass.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { factoryId: { in: [] } } }));
  });

  it('applies park scope before pagination and returns only safe deterministic priority projections', async () => {
    const prisma = readTransaction({
      industrialPark: { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]), count: jest.fn().mockResolvedValue(1) },
      factory: { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1' }]), count: jest.fn().mockResolvedValue(1) },
      gatePass: {
        count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(1),
        findMany: jest.fn().mockResolvedValue([{
          id: 'gate-1', status: 'PENDING', createdAt: new Date('2026-08-28T12:00:00.000Z'),
          factory: { name: 'Scoped factory' }, driverNationalId: 'must-not-leak',
        }]),
      },
      invoice: { count: jest.fn().mockResolvedValue(3) },
      request: {
        count: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(2),
        findMany: jest.fn().mockResolvedValue([
          { id: 'request-high', title: 'Urgent request', status: 'PENDING', priority: 'URGENT', createdAt: new Date('2026-08-27T10:00:00.000Z'), data: { secret: true } },
          { id: 'request-low', title: 'Low request', status: 'PENDING', priority: 'LOW', createdAt: new Date('2026-08-29T10:00:00.000Z') },
        ]),
      },
      emergencyAlert: { count: jest.fn().mockResolvedValue(1) },
      advertisement: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{
          id: 'ad-1', title: 'Scoped advertisement', status: 'PENDING', createdAt: new Date('2026-08-28T11:00:00.000Z'),
          contactInfo: { phone: 'must-not-leak' }, images: ['must-not-leak'],
        }]),
      },
    } as any);
    const service = new ManagementService(prisma, { record: jest.fn() } as any, config);

    const result = await service.dashboard(actor());

    expect(result).toMatchObject({
      factories: 1,
      gatePasses: 4,
      invoices: 3,
      requests: 5,
      openEmergencies: 1,
      pendingWork: { gatePasses: 1, requests: 2, advertisements: 1 },
    });
    expect(result.capabilities).toEqual(expect.arrayContaining(['manage_factories', 'approve_gate_passes', 'approve_requests', 'moderate_advertisements']));
    expect(result.recentPriorityItems.map((item) => item.id)).toEqual(['request-high', 'gate-1', 'ad-1', 'request-low']);
    expect(result.recentPriorityItems[0]).toEqual({
      kind: 'REQUEST', id: 'request-high', status: 'PENDING', createdAt: '2026-08-27T10:00:00.000Z',
      title: 'Urgent request', priority: 'URGENT', capability: 'approve_requests',
    });
    expect(JSON.stringify(result.recentPriorityItems)).not.toMatch(/secret|driverNationalId|contactInfo|images|must-not-leak/);

    const managerFactoryScope = { park: { is: { managers: { some: { id: 'actor-1' } } } } };
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
    expect(prisma.industrialPark.count).toHaveBeenCalledWith({ where: { managers: { some: { id: 'actor-1' } } } });
    expect(prisma.factory.count).toHaveBeenCalledWith({ where: managerFactoryScope });
    expect(prisma.request.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { factory: { is: managerFactoryScope }, status: 'PENDING' },
      take: 8,
    }));
    expect(prisma.gatePass.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { factory: { is: managerFactoryScope }, status: 'PENDING' },
      take: 8,
    }));
    expect(prisma.advertisement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: AdvertisementStatus.PENDING, park: { is: { managers: { some: { id: 'actor-1' } } } } },
      take: 8,
    }));
  });

  it('keeps super-admin aggregation global and advertises every currently routed review capability', async () => {
    const prisma = readTransaction({
      industrialPark: { findMany: jest.fn() },
      factory: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(2) },
      gatePass: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      invoice: { count: jest.fn().mockResolvedValue(0) },
      request: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      emergencyAlert: { count: jest.fn().mockResolvedValue(0) },
      advertisement: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    } as any);
    const service = new ManagementService(prisma, { record: jest.fn() } as any, config);

    const result = await service.dashboard(actor(Role.SUPER_ADMIN));

    expect(prisma.industrialPark.findMany).not.toHaveBeenCalled();
    expect(prisma.factory.findMany).not.toHaveBeenCalled();
    expect(prisma.factory.count).toHaveBeenCalledWith({ where: {} });
    expect(prisma.request.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'PENDING' }, take: 8 }));
    expect(prisma.advertisement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: AdvertisementStatus.PENDING }, take: 8 }));
    expect(result.capabilities).toEqual(expect.arrayContaining([
      'manage_parks', 'manage_users', 'manage_factories', 'approve_gate_passes', 'approve_requests', 'manage_advertisements',
    ]));
  });

  it('propagates a dashboard dependency failure instead of fabricating metrics or empty items', async () => {
    const databaseFailure = new Error('database read failed');
    const prisma = readTransaction({
      industrialPark: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      factory: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockRejectedValue(databaseFailure) },
      gatePass: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      invoice: { count: jest.fn().mockResolvedValue(0) },
      request: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      emergencyAlert: { count: jest.fn().mockResolvedValue(0) },
      advertisement: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    } as any);
    const service = new ManagementService(prisma, { record: jest.fn() } as any, config);

    await expect(service.dashboard(actor())).rejects.toBe(databaseFailure);
  });
});


describe('ManagementService industrial-park CRUD contract', () => {
  const emptyCounts = () => ({
    factories: 0,
    managers: 0,
    announcements: 0,
    advertisements: 0,
    securityGuards: 0,
    scopedFiles: 0,
  });

  it('reads list rows and total from one repeatable snapshot with deterministic ordering', async () => {
    const tx = {
      industrialPark: {
        findMany: jest.fn().mockResolvedValue([{ id: 'park-a' }]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new ManagementService(prisma, { record: jest.fn() } as any, config);

    await expect(service.parks({ page: 2, pageSize: 5, search: ' alpha ' })).resolves.toEqual({
      items: [{ id: 'park-a' }], total: 1, page: 2, pageSize: 5,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
    expect(tx.industrialPark.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: 5, take: 5,
      where: { OR: [
        { name: { contains: 'alpha', mode: 'insensitive' } },
        { code: { contains: 'alpha', mode: 'insensitive' } },
        { city: { contains: 'alpha', mode: 'insensitive' } },
      ] },
    }));
  });

  it('locks and accepts only active approved park managers and returns the final representation', async () => {
    const representation = { id: 'park-1', code: 'PARK-1', managers: [{ id: 'manager-1' }], _count: emptyCounts() };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'manager-1' }]),
      user: { count: jest.fn().mockResolvedValue(1) },
      industrialPark: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'park-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(representation),
      },
    } as any;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.createPark(actor(Role.SUPER_ADMIN), {
      code: ' PARK-1 ', name: ' Park one ', province: ' Province ', city: ' City ', address: ' Address ',
      phoneNumber: ' 021000000 ', guardPhone: ' 021000001 ', managerIds: ['manager-1'], email: '',
    })).resolves.toEqual(representation);
    expect(tx.user.count).toHaveBeenCalledWith({ where: {
      id: { in: ['manager-1'] }, role: Role.PARK_MANAGER, isActive: true, isApproved: true,
    } });
    expect(tx.industrialPark.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ code: 'PARK-1', name: 'Park one', email: null }),
      select: { id: true },
    }));
    expect(tx.industrialPark.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('updates mutable code, nullable values, and manager assignments before re-reading', async () => {
    const representation = { id: 'park-1', code: 'PARK-2', email: null, managers: [], _count: emptyCounts() };
    const tx = {
      industrialPark: {
        findUnique: jest.fn().mockResolvedValueOnce({ id: 'park-1', code: 'PARK-1' }).mockResolvedValueOnce(null),
        update: jest.fn().mockResolvedValue({ id: 'park-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(representation),
      },
    } as any;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.updatePark(actor(Role.SUPER_ADMIN), 'park-1', {
      code: ' PARK-2 ', email: '', description: '', managerIds: [],
    })).resolves.toEqual(representation);
    expect(tx.industrialPark.update).toHaveBeenCalledWith({
      where: { id: 'park-1' },
      data: { code: 'PARK-2', email: null, description: null, managers: { set: [] } },
      select: { id: true },
    });
    expect(tx.industrialPark.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PARK_UPDATED', changes: { fields: ['code', 'email', 'description'], managerIds: [] },
    }), tx);
  });

  it.each([
    ['factories', 'factories'],
    ['manager assignments', 'managers'],
    ['announcements', 'announcements'],
    ['advertisements', 'advertisements'],
    ['security guards', 'securityGuards'],
    ['scoped files', 'scopedFiles'],
  ] as const)('rejects deletion when protected %s exist', async (_label, relation) => {
    const counts = emptyCounts();
    counts[relation] = 1;
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'park-1' }]),
      industrialPark: { findUnique: jest.fn().mockResolvedValue({ _count: counts }), delete: jest.fn() },
      feedback: { count: jest.fn().mockResolvedValue(0) },
    } as any;
    const audit = { record: jest.fn() } as any;
    const service = new ManagementService({ $transaction: jest.fn((callback) => callback(tx)) } as any, audit, config);

    await expect(service.deletePark(actor(Role.SUPER_ADMIN), 'park-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.industrialPark.delete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects deletion when park-targeted feedback exists', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'park-1' }]),
      industrialPark: { findUnique: jest.fn().mockResolvedValue({ _count: emptyCounts() }), delete: jest.fn() },
      feedback: { count: jest.fn().mockResolvedValue(1) },
    } as any;
    const audit = { record: jest.fn() } as any;
    const service = new ManagementService({ $transaction: jest.fn((callback) => callback(tx)) } as any, audit, config);

    await expect(service.deletePark(actor(Role.SUPER_ADMIN), 'park-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.industrialPark.delete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('deletes only an eligible target and audits the committed operation once', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'park-1' }]),
      industrialPark: {
        findUnique: jest.fn().mockResolvedValue({ _count: emptyCounts() }),
        delete: jest.fn().mockResolvedValue({ id: 'park-1' }),
      },
      feedback: { count: jest.fn().mockResolvedValue(0) },
    } as any;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService({ $transaction: jest.fn((callback) => callback(tx)) } as any, audit, config);

    await expect(service.deletePark(actor(Role.SUPER_ADMIN), 'park-1')).resolves.toEqual({ id: 'park-1', deleted: true });
    expect(tx.industrialPark.delete).toHaveBeenCalledWith({ where: { id: 'park-1' } });
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('maps a delete foreign-key race to conflict without a success audit', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'park-1' }]),
      industrialPark: {
        findUnique: jest.fn().mockResolvedValue({ _count: emptyCounts() }),
        delete: jest.fn().mockRejectedValue({ code: 'P2003' }),
      },
      feedback: { count: jest.fn().mockResolvedValue(0) },
    } as any;
    const audit = { record: jest.fn() } as any;
    const service = new ManagementService({ $transaction: jest.fn((callback) => callback(tx)) } as any, audit, config);

    await expect(service.deletePark(actor(Role.SUPER_ADMIN), 'park-1')).rejects.toBeInstanceOf(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });
});


describe('ManagementService user protected-delete matrix', () => {
  const protectedModels = [
    'factory', 'industrialPark', 'gatePass', 'invoice', 'message', 'request', 'announcement', 'advertisement',
    'advertisementFavorite', 'securityGuard', 'notification', 'emergencyAlert', 'paymentTransaction',
    'scopedFile', 'feedback', 'marketRate',
  ] as const;

  it.each(protectedModels)('rejects deletion when the %s business relation exists', async (blockedModel) => {
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'locked' }]),
      user: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'actor-1', role: Role.SUPER_ADMIN, isActive: true, isApproved: true })
          .mockResolvedValueOnce({ id: 'target-1', role: Role.EMPLOYEE, isActive: true, isApproved: true }),
        delete: jest.fn(),
      },
    };
    for (const model of protectedModels) {
      tx[model] = { count: jest.fn().mockResolvedValue(model === blockedModel ? 1 : 0) };
    }
    const audit = { record: jest.fn() } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.deleteUser(actor(Role.SUPER_ADMIN), 'target-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});


describe('ManagementService user phone identity lifecycle', () => {
  it('revokes sessions and consumes every outstanding OTP in the phone-change transaction', async () => {
    const existing = {
      id: 'target-1', phoneNumber: '09120000001', name: 'Target', email: null, username: null, nationalId: null,
      role: Role.EMPLOYEE, isApproved: true, isActive: true, employeeOfFactoryId: null,
      managedParks: [], managedFactories: [],
    };
    const updated = { ...existing, phoneNumber: '09120000002', _count: {} } as any;
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ locked: 1 }])
        .mockResolvedValueOnce([{ id: existing.id }]),
      user: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'actor-1', role: Role.SUPER_ADMIN, isActive: true, isApproved: true })
          .mockResolvedValueOnce(existing)
          .mockResolvedValueOnce(updated),
        update: jest.fn().mockResolvedValue(updated),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      otpChallenge: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.updateUser(actor(Role.SUPER_ADMIN), existing.id, { phoneNumber: updated.phoneNumber })).resolves.toMatchObject({
      id: existing.id,
      phoneNumber: updated.phoneNumber,
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: { phoneNumber: updated.phoneNumber, sessionVersion: { increment: 1 } },
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: existing.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.otpChallenge.updateMany).toHaveBeenCalledWith({
      where: { userId: existing.id, consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(tx.otpChallenge.updateMany.mock.calls[0][0].data.consumedAt)
      .toBe(tx.refreshToken.updateMany.mock.calls[0][0].data.revokedAt);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
});


describe('ManagementService advertisement moderation contract', () => {
  const parks = [
    { id: 'park-a', code: 'A', name: 'Park A' },
    { id: 'park-b', code: 'B', name: 'Park B' },
  ];

  it.each([
    [Role.SUPER_ADMIN, { status: 'ACTIVE' }],
    [Role.PARK_MANAGER, { status: 'ACTIVE', managers: { some: { id: 'actor-1' } } }],
    [Role.FACTORY_OWNER, { status: 'ACTIVE', factories: { some: { managerId: 'actor-1' } } }],
  ] as const)('derives active creation scope from the canonical %s relationship', async (role, expectedWhere) => {
    const prisma = { industrialPark: { findMany: jest.fn().mockResolvedValue(parks) } } as any;
    const service = new ManagementService(prisma, { record: jest.fn() } as any, config);

    await expect(service.advertisementCreationScope(actor(role))).resolves.toEqual({
      canCreate: true,
      requiresSelection: true,
      autoSelectedParkId: null,
      parks,
    });
    expect(prisma.industrialPark.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
  });

  it('rejects ambiguous and mismatched creation scope before writing, while auto-selecting one eligible park', async () => {
    const input = {
      title: ' Advertisement ', category: 'OTHER', province: ' Tehran ', city: ' Tehran ', content: ' Content ',
      contactInfo: { phone: '09120000000' },
    };
    const category = { id: 'category-1', key: 'OTHER', isActive: true };
    const advertisement = {
      id: 'ad-created', title: 'Advertisement', province: 'Tehran', city: 'Tehran', address: null,
      content: 'Content', price: null, contactInfo: { phone: '09120000000', privateNote: 'remove' }, images: [],
      status: AdvertisementStatus.PENDING, isApproved: false, rejectionReason: null, isFeatured: false,
      featuredUntil: null, createdAt: new Date(), updatedAt: new Date(), expiresAt: null, moderatedAt: null,
      category, createdBy: { id: 'actor-1', name: 'Owner', phoneNumber: '09120000000' },
      park: parks[0], moderatedBy: null,
    };
    const tx = {
      advertisementCategoryDef: { findUnique: jest.fn().mockResolvedValue(category) },
      industrialPark: { findMany: jest.fn() },
      advertisement: { create: jest.fn().mockResolvedValue(advertisement) },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService(prisma, audit, config);

    tx.industrialPark.findMany.mockResolvedValueOnce(parks);
    await expect(service.createAdvertisement(actor(Role.FACTORY_OWNER), input)).rejects.toBeInstanceOf(BadRequestException);
    tx.industrialPark.findMany.mockResolvedValueOnce(parks);
    await expect(service.createAdvertisement(actor(Role.FACTORY_OWNER), { ...input, parkId: 'park-outside' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.advertisement.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();

    tx.industrialPark.findMany.mockResolvedValueOnce([parks[0]]);
    await expect(service.createAdvertisement(actor(Role.FACTORY_OWNER), input)).resolves.toMatchObject({
      id: 'ad-created', park: { id: 'park-a' }, contactInfo: { phone: '09120000000' },
    });
    expect(tx.advertisement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ parkId: 'park-a', title: 'Advertisement', content: 'Content' }),
    }));
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('uses one RepeatableRead snapshot, stable ordering, scoped predicates, and an explicit safe contact projection', async () => {
    const record = {
      id: 'ad-1', title: 'Needle', province: 'Tehran', city: 'Tehran', address: null, content: 'Content', price: null,
      contactInfo: { phone: ' 09120000000 ', email: ' safe@example.com ', privateNote: 'remove' }, images: [],
      status: AdvertisementStatus.EXPIRED, isApproved: false, rejectionReason: null, isFeatured: false,
      featuredUntil: null, createdAt: new Date(), updatedAt: new Date(), expiresAt: null, moderatedAt: null,
      category: { id: 'category-1', key: 'OTHER', label: 'Other' },
      createdBy: { id: 'creator-1', name: 'Creator', phoneNumber: '09120000001' },
      park: parks[0], moderatedBy: null,
    };
    const tx = {
      industrialPark: { findMany: jest.fn().mockResolvedValue([parks[0]]) },
      advertisement: { findMany: jest.fn().mockResolvedValue([record]), count: jest.fn().mockResolvedValue(1) },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new ManagementService(prisma, { record: jest.fn() } as any, config);

    await expect(service.managedAdvertisementPage(actor(), {
      view: 'HISTORY', status: AdvertisementStatus.EXPIRED, search: ' Needle ', category: 'OTHER',
      parkId: 'park-a', page: 2, pageSize: 5,
    })).resolves.toMatchObject({
      total: 1, page: 2, pageSize: 5,
      items: [{ id: 'ad-1', contactInfo: { phone: '09120000000', email: 'safe@example.com' } }],
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
    expect(tx.advertisement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: AdvertisementStatus.EXPIRED, parkId: 'park-a' }),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: 5, take: 5,
    }));
    expect(JSON.stringify((await service.managedAdvertisementPage(actor(), { view: 'HISTORY' })).items)).not.toContain('privateNote');
  });

  it('keeps an ambiguous legacy record visible to super admin but rejects every decision without mutation or audit', async () => {
    const tx = {
      advertisement: {
        findUnique: jest.fn().mockResolvedValue({ id: 'legacy-ad', parkId: null, status: AdvertisementStatus.PENDING }),
        updateMany: jest.fn(),
      },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const audit = { record: jest.fn() } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.approveAdvertisement(actor(Role.SUPER_ADMIN), 'legacy-ad', true)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.advertisement.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
