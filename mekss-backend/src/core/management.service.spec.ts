import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdvertisementStatus, FactoryStatus, GatePassStatus, InvoiceStatus, RequestStatus, Role } from '@prisma/client';

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

  it('creates a canonical pending factory and keeps its success audit in the same transaction', async () => {
    const representation = {
      id: 'factory-1', status: FactoryStatus.PENDING, isApproved: false,
      park: { id: 'park-1' }, manager: { id: 'manager-1' }, reviewedBy: null,
    };
    const tx = {
      industrialPark: { findFirst: jest.fn().mockResolvedValue({ id: 'park-1' }) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'manager-1' }) },
      factory: {
        create: jest.fn().mockResolvedValue({ id: 'factory-1' }),
        findUnique: jest.fn().mockResolvedValue(representation),
      },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.createFactory(actor(Role.SUPER_ADMIN), {
      name: 'Factory', licenseNumber: 'LICENSE-1', nationalId: '1234567890', activityType: 'Manufacturing',
      address: 'Factory address', phoneNumber: '09120000000', phoneNumber2: '09120000001', landline: '02112345678',
      fax: '02187654321', email: 'factory@example.com', website: 'https://example.com', description: 'Description',
      licenseExpiry: '2027-01-02T00:00:00.000Z', establishedDate: '2020-03-04T00:00:00.000Z', employees: 42,
      parkId: 'park-1', managerId: 'manager-1',
    })).resolves.toEqual(representation);

    expect(tx.factory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      phoneNumber2: '09120000001', landline: '02112345678', fax: '02187654321', employees: 42,
      status: FactoryStatus.PENDING, isApproved: false,
      licenseExpiry: new Date('2027-01-02T00:00:00.000Z'), establishedDate: new Date('2020-03-04T00:00:00.000Z'),
    }) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'FACTORY_CREATED', entity: 'Factory', entityId: 'factory-1',
    }), tx);
  });

  it('allows exactly one scoped pending factory decision and audits only the winner', async () => {
    const pending = {
      id: 'factory-1', status: FactoryStatus.PENDING, isApproved: false,
      parkId: 'park-1', managerId: 'owner-1', park: { id: 'park-1' }, manager: { id: 'owner-1' }, reviewedBy: null,
    };
    const approved = { ...pending, status: FactoryStatus.ACTIVE, isApproved: true, reviewedBy: { id: 'actor-1' } };
    const tx = {
      industrialPark: { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]) },
      factory: {
        findFirst: jest.fn().mockResolvedValue(pending),
        updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(approved),
      },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.decideFactory(actor(), 'factory-1', true)).resolves.toEqual(approved);
    await expect(service.decideFactory(actor(), 'factory-1', false, 'late rejection')).rejects.toBeInstanceOf(ConflictException);

    expect(tx.factory.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'factory-1', status: FactoryStatus.PENDING, isApproved: false, parkId: { in: ['park-1'] } },
      data: expect.objectContaining({ status: FactoryStatus.ACTIVE, isApproved: true, reviewedById: 'actor-1' }),
    }));
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'FACTORY_APPROVED', entityId: 'factory-1' }), tx);
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


describe('ManagementService invoice and payment contract', () => {
  it('scopes the invoice list to the caller\'s accessible factories', async () => {
    const factory = { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1' }]) };
    const invoice = { findMany: jest.fn().mockResolvedValue([{ id: 'invoice-1' }]) };
    const prisma = { factory, invoice } as any;
    const service = new ManagementService(prisma, { record: jest.fn() } as any, config);

    await expect(service.listInvoices(actor(Role.FACTORY_OWNER))).resolves.toEqual([{ id: 'invoice-1' }]);
    expect(invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { factoryId: { in: ['factory-1'] } },
      orderBy: { issueDate: 'desc' },
    }));
  });

  it('creates a canonical invoice only for an in-scope factory and audits it once', async () => {
    const factory = { count: jest.fn().mockResolvedValue(1) };
    const industrialPark = { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]) };
    const created = { id: 'invoice-1' };
    const invoice = { create: jest.fn().mockResolvedValue(created) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const prisma = { factory, industrialPark, invoice } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.createInvoice(actor(Role.PARK_MANAGER), {
      factoryId: 'factory-1', amount: 1000, taxAmount: 90, description: 'Invoice description', dueDate: '2027-01-01T00:00:00.000Z',
    })).resolves.toEqual(created);

    expect(invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ factoryId: 'factory-1', amount: 1000, taxAmount: 90, totalAmount: 1090 }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'INVOICE_CREATED', entity: 'Invoice', entityId: 'invoice-1' }));
  });

  it('rejects creating an invoice for an out-of-scope factory without writing anything', async () => {
    const factory = { count: jest.fn().mockResolvedValue(0) };
    const invoice = { create: jest.fn() };
    const audit = { record: jest.fn() } as any;
    const service = new ManagementService({ factory, invoice } as any, audit, config);

    await expect(service.createInvoice(actor(Role.FACTORY_OWNER), {
      factoryId: 'out-of-scope', amount: 1000, description: 'Invoice description', dueDate: '2027-01-01T00:00:00.000Z',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(invoice.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects a non-positive invoice amount before any write', async () => {
    const factory = { count: jest.fn().mockResolvedValue(1) };
    const invoice = { create: jest.fn() };
    const service = new ManagementService({ factory, invoice } as any, { record: jest.fn() } as any, config);

    await expect(service.createInvoice(actor(Role.FACTORY_OWNER), {
      factoryId: 'factory-1', amount: 0, description: 'Invoice description', dueDate: '2027-01-01T00:00:00.000Z',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(invoice.create).not.toHaveBeenCalled();
  });

  it('returns the cached payment response for a retried idempotency key instead of creating a duplicate transaction', async () => {
    const factory = { count: jest.fn().mockResolvedValue(1) };
    const invoiceRow = { id: 'invoice-1', factoryId: 'factory-1', status: InvoiceStatus.PENDING, totalAmount: 1000, description: 'Invoice' };
    const invoice = { findUnique: jest.fn().mockResolvedValue(invoiceRow) };
    const paymentTransaction = {
      findUnique: jest.fn().mockResolvedValue({ authority: 'cached-authority' }),
      create: jest.fn(),
    };
    const audit = { record: jest.fn() } as any;
    const service = new ManagementService({ factory, invoice, paymentTransaction } as any, audit, config);

    const result = await service.startPayment(actor(Role.FACTORY_OWNER), 'invoice-1', 'retry-key-1');

    expect(result.authority).toBe('cached-authority');
    expect(paymentTransaction.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects starting payment on a non-pending invoice', async () => {
    const factory = { count: jest.fn().mockResolvedValue(1) };
    const invoice = { findUnique: jest.fn().mockResolvedValue({ id: 'invoice-1', factoryId: 'factory-1', status: InvoiceStatus.PAID }) };
    const paymentTransaction = { findUnique: jest.fn(), create: jest.fn() };
    const service = new ManagementService({ factory, invoice, paymentTransaction } as any, { record: jest.fn() } as any, config);

    await expect(service.startPayment(actor(Role.FACTORY_OWNER), 'invoice-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(paymentTransaction.create).not.toHaveBeenCalled();
  });
});

describe('ManagementService gate-pass state machine contract', () => {
  it('creates a gate pass only within factory scope and audits it once', async () => {
    const factory = { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1' }]), count: jest.fn().mockResolvedValue(1) };
    const gatePass = { create: jest.fn().mockResolvedValue({ id: 'pass-1' }) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService({ factory, gatePass } as any, audit, config);

    await expect(service.createGatePass(actor(Role.FACTORY_OWNER), {
      factoryId: 'factory-1', cargoType: 'RAW_MATERIALS', driverName: 'Driver', driverNationalId: '1234567890',
      driverPhone: '09120000000', vehicleType: 'TRUCK', licensePlate: '12A34567', exitDate: '2027-01-01T00:00:00.000Z',
    })).resolves.toEqual({ id: 'pass-1' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'GATE_PASS_CREATED', entityId: 'pass-1' }));
  });

  it.each([
    ['approve', GatePassStatus.PENDING, undefined, { status: GatePassStatus.APPROVED, approvedById: 'actor-1' }],
    ['reject', GatePassStatus.PENDING, 'Invalid cargo', { status: GatePassStatus.REJECTED, approvedById: 'actor-1', notes: 'Invalid cargo' }],
    ['verify', GatePassStatus.APPROVED, undefined, { status: GatePassStatus.COMPLETED, verifiedById: 'actor-1', verifiedAt: expect.any(Date) }],
    ['deny', GatePassStatus.APPROVED, 'Plate mismatch', { status: GatePassStatus.REJECTED, verifiedById: 'actor-1', verifiedAt: expect.any(Date), notes: 'Plate mismatch' }],
  ] as const)('commits a valid %s transition from the required source state', async (action, sourceStatus, reason, expectedData) => {
    const factory = { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1' }]), count: jest.fn().mockResolvedValue(1) };
    const gatePass = {
      findUnique: jest.fn().mockResolvedValue({ id: 'pass-1', factoryId: 'factory-1', status: sourceStatus }),
      update: jest.fn().mockResolvedValue({ id: 'pass-1', status: 'updated' }),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService({ factory, gatePass } as any, audit, config);

    await expect(service.gatePassAction(actor(Role.SUPER_ADMIN), 'pass-1', action, reason)).resolves.toEqual({ id: 'pass-1', status: 'updated' });
    expect(gatePass.update).toHaveBeenCalledWith({ where: { id: 'pass-1' }, data: expectedData });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: `GATE_PASS_${action.toUpperCase()}`, entityId: 'pass-1' }));
  });

  it('rejects approving a gate pass that is not pending, without mutating it', async () => {
    const factory = { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1' }]), count: jest.fn().mockResolvedValue(1) };
    const gatePass = {
      findUnique: jest.fn().mockResolvedValue({ id: 'pass-1', factoryId: 'factory-1', status: GatePassStatus.APPROVED }),
      update: jest.fn(),
    };
    const service = new ManagementService({ factory, gatePass } as any, { record: jest.fn() } as any, config);

    await expect(service.gatePassAction(actor(Role.SUPER_ADMIN), 'pass-1', 'approve')).rejects.toBeInstanceOf(ConflictException);
    expect(gatePass.update).not.toHaveBeenCalled();
  });

  it('rejects a blank reject/deny reason before mutating', async () => {
    const factory = { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1' }]), count: jest.fn().mockResolvedValue(1) };
    const gatePass = {
      findUnique: jest.fn().mockResolvedValue({ id: 'pass-1', factoryId: 'factory-1', status: GatePassStatus.PENDING }),
      update: jest.fn(),
    };
    const service = new ManagementService({ factory, gatePass } as any, { record: jest.fn() } as any, config);

    await expect(service.gatePassAction(actor(Role.SUPER_ADMIN), 'pass-1', 'reject', '   ')).rejects.toBeInstanceOf(BadRequestException);
    expect(gatePass.update).not.toHaveBeenCalled();
  });

  it('rejects verifying a gate pass outside factory scope', async () => {
    const factory = { count: jest.fn().mockResolvedValue(0) };
    const industrialPark = { findMany: jest.fn().mockResolvedValue([]) };
    const gatePass = { findUnique: jest.fn().mockResolvedValue({ id: 'pass-1', factoryId: 'out-of-scope', status: GatePassStatus.APPROVED }), update: jest.fn() };
    const service = new ManagementService({ factory, industrialPark, gatePass } as any, { record: jest.fn() } as any, config);

    await expect(service.gatePassAction(actor(Role.SECURITY_GUARD), 'pass-1', 'verify')).rejects.toBeInstanceOf(ForbiddenException);
    expect(gatePass.update).not.toHaveBeenCalled();
  });
});

describe('ManagementService request review contract', () => {
  it('creates a scoped pending request and audits it once', async () => {
    const factory = { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1' }]), count: jest.fn().mockResolvedValue(1) };
    const request = { create: jest.fn().mockResolvedValue({ id: 'request-1' }) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService({ factory, request } as any, audit, config);

    await expect(service.createRequest(actor(Role.FACTORY_OWNER), {
      factoryId: 'factory-1', type: 'OTHER', title: 'Title', description: 'Description',
    })).resolves.toEqual({ id: 'request-1' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'REQUEST_CREATED', entityId: 'request-1' }));
  });

  it.each([
    ['approve', { status: RequestStatus.APPROVED, approverId: 'actor-1', approvedAt: expect.any(Date) }],
    ['reject', { status: RequestStatus.REJECTED, approverId: 'actor-1', rejectedAt: expect.any(Date), rejectionReason: 'Invalid request' }],
  ] as const)('commits a valid %s transition from PENDING and audits it once', async (action, expectedData) => {
    const factory = { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1' }]), count: jest.fn().mockResolvedValue(1) };
    const request = {
      findUnique: jest.fn().mockResolvedValue({ id: 'request-1', factoryId: 'factory-1', status: RequestStatus.PENDING }),
      update: jest.fn().mockResolvedValue({ id: 'request-1', status: 'updated' }),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService({ factory, request } as any, audit, config);

    await expect(service.requestAction(actor(Role.SUPER_ADMIN), 'request-1', action, action === 'reject' ? 'Invalid request' : undefined))
      .resolves.toEqual({ id: 'request-1', status: 'updated' });
    expect(request.update).toHaveBeenCalledWith({ where: { id: 'request-1' }, data: expectedData });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: `REQUEST_${action.toUpperCase()}`, entityId: 'request-1' }));
  });

  it('rejects deciding on a request that is not pending, without mutating it', async () => {
    const factory = { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1' }]), count: jest.fn().mockResolvedValue(1) };
    const request = {
      findUnique: jest.fn().mockResolvedValue({ id: 'request-1', factoryId: 'factory-1', status: RequestStatus.APPROVED }),
      update: jest.fn(),
    };
    const service = new ManagementService({ factory, request } as any, { record: jest.fn() } as any, config);

    await expect(service.requestAction(actor(Role.SUPER_ADMIN), 'request-1', 'approve')).rejects.toBeInstanceOf(BadRequestException);
    expect(request.update).not.toHaveBeenCalled();
  });

  it('rejects deciding on an out-of-scope request', async () => {
    const factory = { count: jest.fn().mockResolvedValue(0) };
    const industrialPark = { findMany: jest.fn().mockResolvedValue([]) };
    const request = { findUnique: jest.fn().mockResolvedValue({ id: 'request-1', factoryId: 'out-of-scope', status: RequestStatus.PENDING }), update: jest.fn() };
    const service = new ManagementService({ factory, industrialPark, request } as any, { record: jest.fn() } as any, config);

    await expect(service.requestAction(actor(Role.PARK_MANAGER), 'request-1', 'approve')).rejects.toBeInstanceOf(ForbiddenException);
    expect(request.update).not.toHaveBeenCalled();
  });
});

describe('ManagementService announcement contract', () => {
  it('creates a global announcement without requiring park scope', async () => {
    const announcement = { create: jest.fn().mockResolvedValue({ id: 'ann-1' }) };
    const industrialPark = { findMany: jest.fn() };
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService({ announcement, industrialPark } as any, audit, config);

    await expect(service.createAnnouncement(actor(Role.SUPER_ADMIN), {
      title: 'Title', content: 'Content', isGlobal: true,
    })).resolves.toEqual({ id: 'ann-1' });
    expect(industrialPark.findMany).not.toHaveBeenCalled();
    expect(announcement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isGlobal: true, parkId: undefined }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ANNOUNCEMENT_CREATED', entityId: 'ann-1' }));
  });

  it('rejects a park manager creating an announcement scoped to a park they do not manage', async () => {
    const announcement = { create: jest.fn() };
    const industrialPark = { findMany: jest.fn().mockResolvedValue([{ id: 'park-owned' }]) };
    const service = new ManagementService({ announcement, industrialPark } as any, { record: jest.fn() } as any, config);

    await expect(service.createAnnouncement(actor(Role.PARK_MANAGER), {
      title: 'Title', content: 'Content', parkId: 'park-not-owned',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(announcement.create).not.toHaveBeenCalled();
  });

  it('allows a park manager to create an announcement scoped to their own park', async () => {
    const announcement = { create: jest.fn().mockResolvedValue({ id: 'ann-1' }) };
    const industrialPark = { findMany: jest.fn().mockResolvedValue([{ id: 'park-owned' }]) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService({ announcement, industrialPark } as any, audit, config);

    await expect(service.createAnnouncement(actor(Role.PARK_MANAGER), {
      title: 'Title', content: 'Content', parkId: 'park-owned',
    })).resolves.toEqual({ id: 'ann-1' });
    expect(announcement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ parkId: 'park-owned' }) }));
  });

  it('updates only the whitelisted mutable fields and audits the exact changes', async () => {
    const existing = { id: 'ann-1', createdById: 'actor-1', parkId: null };
    const updated = { id: 'ann-1', title: 'New title' };
    const announcement = {
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(updated),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService({ announcement } as any, audit, config);

    await expect(service.updateAnnouncement(actor(Role.PARK_MANAGER), 'ann-1', { title: 'New title', isPinned: true }))
      .resolves.toEqual(updated);
    expect(announcement.update).toHaveBeenCalledWith({ where: { id: 'ann-1' }, data: { title: 'New title', isPinned: true } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ANNOUNCEMENT_UPDATED', changes: { title: 'New title', isPinned: true },
    }));
  });

  it('rejects an empty announcement update before touching the database', async () => {
    const announcement = { findUnique: jest.fn(), update: jest.fn() };
    const service = new ManagementService({ announcement } as any, { record: jest.fn() } as any, config);

    await expect(service.updateAnnouncement(actor(Role.SUPER_ADMIN), 'ann-1', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(announcement.findUnique).not.toHaveBeenCalled();
    expect(announcement.update).not.toHaveBeenCalled();
  });

  it('rejects updating an announcement outside the actor\'s access without mutating it', async () => {
    const existing = { id: 'ann-1', createdById: 'someone-else', parkId: 'park-not-owned' };
    const announcement = { findUnique: jest.fn().mockResolvedValue(existing), update: jest.fn() };
    const industrialPark = { findMany: jest.fn().mockResolvedValue([]) };
    const service = new ManagementService({ announcement, industrialPark } as any, { record: jest.fn() } as any, config);

    await expect(service.updateAnnouncement(actor(Role.PARK_MANAGER), 'ann-1', { title: 'Hijack' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(announcement.update).not.toHaveBeenCalled();
  });

  it('deletes an eligible announcement and audits it exactly once', async () => {
    const existing = { id: 'ann-1', createdById: 'actor-1', parkId: null };
    const announcement = { findUnique: jest.fn().mockResolvedValue(existing), delete: jest.fn().mockResolvedValue(existing) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService({ announcement } as any, audit, config);

    await expect(service.deleteAnnouncement(actor(Role.SUPER_ADMIN), 'ann-1')).resolves.toEqual({ id: 'ann-1', deleted: true });
    expect(announcement.delete).toHaveBeenCalledWith({ where: { id: 'ann-1' } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ANNOUNCEMENT_DELETED', entityId: 'ann-1' }));
  });

  it('rejects deleting a missing announcement', async () => {
    const announcement = { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn() };
    const service = new ManagementService({ announcement } as any, { record: jest.fn() } as any, config);

    await expect(service.deleteAnnouncement(actor(Role.SUPER_ADMIN), 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(announcement.delete).not.toHaveBeenCalled();
  });
});

describe('ManagementService messaging contract', () => {
  it('creates exactly one durable message per resolved active recipient and reports excluded recipients without disclosing them', async () => {
    const user = { findMany: jest.fn().mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]) };
    const message = { create: jest.fn().mockResolvedValueOnce({ id: 'msg-1' }).mockResolvedValueOnce({ id: 'msg-2' }) };
    const prisma = { user, message, $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)) } as any;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ManagementService(prisma, audit, config);

    await expect(service.sendMessage(actor(Role.SUPER_ADMIN), ['user-1', 'user-2', 'inactive-user'], 'Subject', 'Body'))
      .resolves.toEqual({ sentCount: 2, excludedCount: 1 });
    expect(message.create).toHaveBeenCalledTimes(2);
    expect(message.create).toHaveBeenCalledWith({ data: { senderId: 'actor-1', receiverId: 'user-1', subject: 'Subject', body: 'Body' } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'MESSAGE_BATCH_SENT', changes: { recipientCount: 2 } }));
  });

  it('rejects a batch with zero resolvable recipients without creating a transaction', async () => {
    const user = { findMany: jest.fn().mockResolvedValue([]) };
    const message = { create: jest.fn() };
    const prisma = { user, message, $transaction: jest.fn() } as any;
    const service = new ManagementService(prisma, { record: jest.fn() } as any, config);

    await expect(service.sendMessage(actor(Role.SUPER_ADMIN), ['missing-1'], 'Subject', 'Body')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deduplicates repeated recipient ids into a single resolved message', async () => {
    const user = { findMany: jest.fn().mockResolvedValue([{ id: 'user-1' }]) };
    const message = { create: jest.fn().mockResolvedValue({ id: 'msg-1' }) };
    const prisma = { user, message, $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)) } as any;
    const service = new ManagementService(prisma, { record: jest.fn() } as any, config);

    await expect(service.sendMessage(actor(Role.SUPER_ADMIN), ['user-1', 'user-1'], 'Subject', 'Body'))
      .resolves.toEqual({ sentCount: 1, excludedCount: 0 });
    expect(user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['user-1'] }, isActive: true } }));
  });

  it('returns the caller\'s own inbox ordered by newest first', async () => {
    const message = { findMany: jest.fn().mockResolvedValue([{ id: 'msg-1' }]) };
    const service = new ManagementService({ message } as any, { record: jest.fn() } as any, config);

    await expect(service.inboxMessages(actor(Role.SUPER_ADMIN))).resolves.toEqual([{ id: 'msg-1' }]);
    expect(message.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { receiverId: 'actor-1' } }));
  });

  it('marks the caller\'s own message read idempotently', async () => {
    const message = {
      findUnique: jest.fn().mockResolvedValue({ id: 'msg-1', receiverId: 'actor-1', status: 'UNREAD' }),
      update: jest.fn().mockResolvedValue({ id: 'msg-1', status: 'READ' }),
    };
    const service = new ManagementService({ message } as any, { record: jest.fn() } as any, config);

    await expect(service.markMessageRead(actor(Role.SUPER_ADMIN), 'msg-1')).resolves.toEqual({ id: 'msg-1', status: 'READ' });
    expect(message.update).toHaveBeenCalledWith({ where: { id: 'msg-1' }, data: { status: 'READ' } });
  });

  it('rejects marking another recipient\'s message as read', async () => {
    const message = { findUnique: jest.fn().mockResolvedValue({ id: 'msg-1', receiverId: 'someone-else' }), update: jest.fn() };
    const service = new ManagementService({ message } as any, { record: jest.fn() } as any, config);

    await expect(service.markMessageRead(actor(Role.SUPER_ADMIN), 'msg-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(message.update).not.toHaveBeenCalled();
  });
});

describe('ManagementService reports contract', () => {
  it('derives financial totals from real scoped invoice rows', async () => {
    const factory = { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1' }]) };
    const invoice = { findMany: jest.fn().mockResolvedValue([
      { status: InvoiceStatus.PAID, totalAmount: 1000 },
      { status: InvoiceStatus.PENDING, totalAmount: 500 },
    ]) };
    const service = new ManagementService({ factory, invoice } as any, { record: jest.fn() } as any, config);

    await expect(service.report(actor(Role.FACTORY_OWNER), 'financial')).resolves.toEqual({
      type: 'financial', count: 2, totalAmount: 1500, paidAmount: 1000, unpaidAmount: 500,
    });
    expect(invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { factoryId: { in: ['factory-1'] } } }));
  });

  it('scopes gate-pass status aggregation to the caller\'s factories', async () => {
    const industrialPark = { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]) };
    const factory = { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1' }]) };
    const gatePass = { groupBy: jest.fn().mockResolvedValue([{ status: 'PENDING', _count: 3 }]) };
    const service = new ManagementService({ industrialPark, factory, gatePass } as any, { record: jest.fn() } as any, config);

    await expect(service.report(actor(Role.PARK_MANAGER), 'gatepass')).resolves.toEqual({
      type: 'gatepass', byStatus: [{ status: 'PENDING', count: 3 }],
    });
    expect(gatePass.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { factoryId: { in: ['factory-1'] } } }));
  });

  it('keeps the report aggregation predicate global for super-admin and government-official reads', async () => {
    const factory = { findMany: jest.fn().mockResolvedValue([]) };
    const request = { groupBy: jest.fn().mockResolvedValue([]) };
    const service = new ManagementService({ factory, request } as any, { record: jest.fn() } as any, config);

    await expect(service.report(actor(Role.GOVERNMENT_OFFICIAL), 'requests')).resolves.toEqual({ type: 'requests', byStatus: [] });
    expect(request.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});

describe('ManagementService SMS health contract', () => {
  it('never returns the raw sender or API key, only a masked sender and a presence flag', async () => {
    const sms = { get: jest.fn((key: string, fallback?: string) => {
      if (key === 'SMS_PROVIDER') return 'kavenegar';
      if (key === 'SMS_SENDER') return '10008663';
      if (key === 'KAVEH_NEGAR_API_KEY') return 'super-secret-api-key';
      return fallback;
    }) } as any;
    const service = new ManagementService({} as any, { record: jest.fn() } as any, sms);

    await expect(service.smsHealth()).resolves.toEqual({ provider: 'kavenegar', configured: true, maskedSender: '1000***63' });
  });

  it('reports not configured when no provider key is present and mock provider is always considered configured', async () => {
    const sms = { get: jest.fn((key: string, fallback?: string) => (key === 'SMS_PROVIDER' ? 'mock' : fallback)) } as any;
    const service = new ManagementService({} as any, { record: jest.fn() } as any, sms);

    await expect(service.smsHealth()).resolves.toEqual({ provider: 'mock', configured: true, maskedSender: null });
  });
});
