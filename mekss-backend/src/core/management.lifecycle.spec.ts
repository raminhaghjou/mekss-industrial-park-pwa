import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GatePassStatus, InvoiceAdjustmentType, InvoiceCategory, InvoiceStatus, InvoiceTarget, Role } from '@prisma/client';

jest.mock('bcrypt', () => ({ hash: jest.fn(async (value: string) => `hashed:${value}`) }));

import { ManagementService } from './management.service';

const actor = (role: Role = Role.PARK_MANAGER, id = 'actor-1') => ({ id, role, phoneNumber: '09120000000' });
const config = { get: jest.fn((_key: string, fallback?: string) => fallback) } as any;
const audit = () => ({ record: jest.fn().mockResolvedValue(undefined) }) as any;
const notifications = () => ({
  notification: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
});

describe('ManagementService.cancelGatePass', () => {
  const build = (status: GatePassStatus, claimed = 1) => {
    const prisma = {
      ...notifications(),
      factory: { count: jest.fn().mockResolvedValue(1) },
      industrialPark: { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'guard-1', phoneNumber: '09124444444' }]) },
      gatePass: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pass-1',
          factoryId: 'factory-1',
          status,
          notes: 'هزینه مجوز عبور: 1000',
          driverName: 'Driver',
          licensePlate: '12A34567',
          factory: { name: 'Factory', parkId: 'park-1', managerId: 'owner-1', manager: { phoneNumber: '09122222222' }, park: { guardPhone: '09123333333' } },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: claimed }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'pass-1', status: GatePassStatus.CANCELLED }),
      },
    };
    return prisma;
  };

  it('cancels an approved pass, keeps earlier notes and warns the gate', async () => {
    const prisma = build(GatePassStatus.APPROVED);
    const log = audit();
    const service = new ManagementService(prisma as any, log, config);

    await expect(service.cancelGatePass(actor(Role.FACTORY_OWNER, 'owner-1'), 'pass-1', ' خطای ثبت ')).resolves.toEqual(expect.objectContaining({ status: GatePassStatus.CANCELLED }));

    expect(prisma.gatePass.updateMany).toHaveBeenCalledWith({
      where: { id: 'pass-1', status: GatePassStatus.APPROVED },
      data: { status: GatePassStatus.CANCELLED, notes: 'هزینه مجوز عبور: 1000\nلغو شد: خطای ثبت' },
    });
    expect(log.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'GATE_PASS_CANCELLED', changes: { from: GatePassStatus.APPROVED, reason: 'خطای ثبت' } }));
    const or = prisma.user.findMany.mock.calls[0][0].where.OR;
    expect(or).toEqual(expect.arrayContaining([{ role: Role.SECURITY_GUARD, securityShifts: { some: { parkId: 'park-1', isActive: true } } }]));
    // The owner cancelled it, so they are not notified about their own action.
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it.each([GatePassStatus.COMPLETED, GatePassStatus.EXPIRED, GatePassStatus.CANCELLED])('refuses to cancel a %s pass', async (status) => {
    const prisma = build(status);
    const service = new ManagementService(prisma as any, audit(), config);

    await expect(service.cancelGatePass(actor(Role.PARK_MANAGER), 'pass-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.gatePass.updateMany).not.toHaveBeenCalled();
  });

  it('reports a conflict when the pass changed meanwhile', async () => {
    const prisma = build(GatePassStatus.PENDING, 0);
    const service = new ManagementService(prisma as any, audit(), config);

    await expect(service.cancelGatePass(actor(Role.PARK_MANAGER), 'pass-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.gatePass.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('forbids guards and out-of-scope users', async () => {
    const prisma = build(GatePassStatus.PENDING);
    const service = new ManagementService(prisma as any, audit(), config);
    await expect(service.cancelGatePass(actor(Role.SECURITY_GUARD), 'pass-1')).rejects.toBeInstanceOf(ForbiddenException);

    prisma.factory.count.mockResolvedValue(0);
    await expect(service.cancelGatePass(actor(Role.FACTORY_OWNER), 'pass-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.gatePass.updateMany).not.toHaveBeenCalled();
  });
});

describe('ManagementService.cancelInvoice', () => {
  const invoice = (status: InvoiceStatus) => ({
    id: 'inv-1',
    invoiceNumber: 'INV-1',
    status,
    createdById: 'someone-else',
    targetType: InvoiceTarget.FACTORY,
    category: InvoiceCategory.CHARGE,
    factoryId: 'factory-1',
    parkId: 'park-1',
    amount: 1000,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 1000,
    latePenaltyPerDay: 0,
    dueDate: new Date(Date.now() + 86_400_000),
  });
  const build = (status: InvoiceStatus, claimed = 1) => {
    const prisma: any = {
      ...notifications(),
      industrialPark: { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]) },
      paymentTransaction: { count: jest.fn().mockResolvedValue(0) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      factory: { findUnique: jest.fn().mockResolvedValue({ managerId: 'owner-1' }) },
      invoice: {
        findUnique: jest.fn().mockResolvedValue(invoice(status)),
        updateMany: jest.fn().mockResolvedValue({ count: claimed }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...invoice(InvoiceStatus.CANCELLED), items: [] }),
      },
      invoiceAdjustment: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction = jest.fn((callback) => callback(prisma));
    return prisma;
  };

  it('voids an open invoice and records a cancellation adjustment', async () => {
    const prisma = build(InvoiceStatus.OVERDUE);
    const log = audit();
    const service = new ManagementService(prisma, log, config);

    await expect(service.cancelInvoice(actor(Role.PARK_MANAGER), 'inv-1', 'صدور تکراری')).resolves.toEqual(expect.objectContaining({ id: 'inv-1' }));
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] } },
      data: { status: InvoiceStatus.CANCELLED },
    });
    expect(prisma.invoiceAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: InvoiceAdjustmentType.CANCELLATION, note: 'صدور تکراری', actorId: 'actor-1' }),
    });
    expect(log.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'INVOICE_CANCELLED', entityId: 'inv-1' }));
  });

  it.each([InvoiceStatus.PAID, InvoiceStatus.CANCELLED, InvoiceStatus.INSTALLMENTS, InvoiceStatus.AWAITING_CONFIRMATION])('refuses a %s invoice', async (status) => {
    const prisma = build(status);
    const service = new ManagementService(prisma, audit(), config);

    await expect(service.cancelInvoice(actor(Role.PARK_MANAGER), 'inv-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });

  it('refuses while an online payment is in flight', async () => {
    const prisma = build(InvoiceStatus.PENDING);
    prisma.paymentTransaction.count.mockResolvedValue(1);
    const service = new ManagementService(prisma, audit(), config);

    await expect(service.cancelInvoice(actor(Role.PARK_MANAGER), 'inv-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });

  it('forbids a park manager of another park', async () => {
    const prisma = build(InvoiceStatus.PENDING);
    prisma.industrialPark.findMany.mockResolvedValue([{ id: 'park-2' }]);
    const service = new ManagementService(prisma, audit(), config);

    await expect(service.cancelInvoice(actor(Role.PARK_MANAGER), 'inv-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ManagementService factory lifecycle', () => {
  const record = { id: 'factory-1', name: 'Factory', parkId: 'park-1', managerId: 'owner-1', manager: { id: 'owner-1', name: 'Old', phoneNumber: '09121111111' } };
  const build = () => {
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'factory-1' }]),
      gatePass: { count: jest.fn().mockResolvedValue(0) },
      invoice: { count: jest.fn().mockResolvedValue(0) },
      request: { count: jest.fn().mockResolvedValue(0) },
      announcement: { count: jest.fn().mockResolvedValue(0) },
      walletTopUp: { count: jest.fn().mockResolvedValue(0) },
      factoryEmployee: { count: jest.fn().mockResolvedValue(0) },
      user: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue({ id: 'owner-2' }) },
      industrialPark: { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]) },
      factory: {
        findFirst: jest.fn().mockResolvedValue(record),
        findUnique: jest.fn().mockResolvedValue({ gatePassWalletBalance: 0, ...record, managerId: 'owner-2', manager: { id: 'owner-2', name: 'New', phoneNumber: '09122222222' } }),
        delete: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma: any = { ...tx, ...notifications(), $transaction: jest.fn((callback) => callback(tx)) };
    return { prisma, tx };
  };

  it('deletes a unit without history', async () => {
    const { prisma, tx } = build();
    const log = audit();
    const service = new ManagementService(prisma, log, config);

    await expect(service.deleteFactory(actor(Role.PARK_MANAGER), 'factory-1')).resolves.toEqual({ id: 'factory-1', deleted: true });
    expect(tx.factory.delete).toHaveBeenCalledWith({ where: { id: 'factory-1' } });
    expect(log.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'FACTORY_DELETED', entityId: 'factory-1' }), tx);
  });

  it('lists the business history that blocks deletion', async () => {
    const { prisma, tx } = build();
    tx.gatePass.count.mockResolvedValue(2);
    tx.factory.findUnique.mockResolvedValue({ gatePassWalletBalance: 5000 });
    const service = new ManagementService(prisma, audit(), config);

    const error = await service.deleteFactory(actor(Role.SUPER_ADMIN), 'factory-1').catch((caught) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.message).toContain('برگ خروج');
    expect(error.message).toContain('موجودی کیف پول');
    expect(tx.factory.delete).not.toHaveBeenCalled();
  });

  it('only lets park management delete units', async () => {
    const { prisma, tx } = build();
    const service = new ManagementService(prisma, audit(), config);

    await expect(service.deleteFactory(actor(Role.FACTORY_OWNER), 'factory-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.factory.delete).not.toHaveBeenCalled();
  });

  it('hands the unit to another approved owner and tells both', async () => {
    const { prisma, tx } = build();
    const log = audit();
    const service = new ManagementService(prisma, log, config);

    await expect(service.changeFactoryOwner(actor(Role.PARK_MANAGER), 'factory-1', 'owner-2')).resolves.toEqual(expect.objectContaining({ managerId: 'owner-2' }));
    expect(tx.factory.updateMany).toHaveBeenCalledWith({ where: { id: 'factory-1', managerId: 'owner-1' }, data: { managerId: 'owner-2' } });
    expect(log.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'FACTORY_OWNER_CHANGED', changes: { from: 'owner-1', to: 'owner-2' } }), tx);
    const notified = prisma.notification.create.mock.calls.map(([call]: any) => call.data.userId);
    expect(notified).toEqual(expect.arrayContaining(['owner-1', 'owner-2']));
  });

  it('rejects an owner that is not an approved factory owner, or the same owner', async () => {
    const { prisma, tx } = build();
    tx.user.findFirst.mockResolvedValue(null);
    const service = new ManagementService(prisma, audit(), config);

    await expect(service.changeFactoryOwner(actor(Role.SUPER_ADMIN), 'factory-1', 'owner-2')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.changeFactoryOwner(actor(Role.SUPER_ADMIN), 'factory-1', 'owner-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.factory.updateMany).not.toHaveBeenCalled();
  });

  it('keeps a park manager from taking an owner who runs a unit in another park', async () => {
    const { prisma, tx } = build();
    tx.factory.count.mockResolvedValue(1);
    const service = new ManagementService(prisma, audit(), config);

    await expect(service.changeFactoryOwner(actor(Role.PARK_MANAGER), 'factory-1', 'owner-2')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.factory.updateMany).not.toHaveBeenCalled();
  });
});

describe('ManagementService.feedbackInbox', () => {
  const build = () => {
    const prisma: any = {
      industrialPark: { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]) },
      feedback: { findMany: jest.fn().mockResolvedValue([{ id: 'fb-1' }]), count: jest.fn().mockResolvedValue(1) },
    };
    prisma.$transaction = jest.fn((operations: Promise<unknown>[]) => Promise.all(operations));
    return prisma;
  };

  it('limits park managers to their parks', async () => {
    const prisma = build();
    const service = new ManagementService(prisma, audit(), config);

    await expect(service.feedbackInbox(actor(Role.PARK_MANAGER), { search: 'آب' })).resolves.toEqual({ items: [{ id: 'fb-1' }], total: 1, page: 1, pageSize: 20 });
    const where = prisma.feedback.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({ recipientParkId: { in: ['park-1'] } });
    await expect(service.feedbackInbox(actor(Role.PARK_MANAGER), { parkId: 'park-2' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets super admins filter platform feedback and blocks other roles', async () => {
    const prisma = build();
    const service = new ManagementService(prisma, audit(), config);

    await service.feedbackInbox(actor(Role.SUPER_ADMIN), { target: 'PLATFORM' });
    expect(prisma.feedback.findMany.mock.calls[0][0].where).toEqual({ AND: [{ recipientParkId: null }] });
    await expect(service.feedbackInbox(actor(Role.FACTORY_OWNER))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ManagementService factory staff', () => {
  const blockerModels = ['gatePass', 'invoice', 'invoiceAdjustment', 'invoiceImportBatch', 'message', 'request', 'announcement', 'advertisement', 'dashboardBanner', 'securityGuard', 'emergencyAlert', 'paymentTransaction', 'scopedFile', 'mediaAsset', 'feedback'];
  const build = (historyCount = 0) => {
    const prisma: any = {
      factory: { count: jest.fn().mockResolvedValue(1), findUnique: jest.fn().mockResolvedValue({ name: 'Factory' }) },
      industrialPark: { count: jest.fn().mockResolvedValue(0) },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }),
        update: jest.fn().mockResolvedValue({ id: 'staff-1', phoneNumber: '09125555555' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    for (const model of blockerModels) prisma[model] = { count: jest.fn().mockResolvedValue(historyCount) };
    // Ownership check (id + managerId) passes; "units managed by this user" follows the history count.
    prisma.factory.count = jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where.id ? 1 : historyCount));
    return prisma;
  };
  const owner = actor(Role.FACTORY_OWNER, 'owner-1');

  it('deletes a staff account without history', async () => {
    const prisma = build(0);
    const service = new ManagementService(prisma, audit(), config);

    await expect(service.deleteFactoryStaff(owner, 'factory-1', 'staff-1')).resolves.toEqual({ id: 'staff-1', deleted: true, deactivated: false });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'staff-1' } });
  });

  it('deactivates instead of deleting when the account has history', async () => {
    const prisma = build(3);
    const service = new ManagementService(prisma, audit(), config);

    await expect(service.deleteFactoryStaff(owner, 'factory-1', 'staff-1')).resolves.toEqual(expect.objectContaining({ deleted: false, deactivated: true }));
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'staff-1' }, data: { isActive: false, sessionVersion: { increment: 1 } } });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('refuses staff of another factory', async () => {
    const prisma = build(0);
    prisma.user.findFirst.mockResolvedValue(null);
    const service = new ManagementService(prisma, audit(), config);

    await expect(service.deleteFactoryStaff(owner, 'factory-1', 'staff-9')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resets the password as a temporary one and ends open sessions', async () => {
    const prisma = build(0);
    const log = audit();
    const service = new ManagementService(prisma, log, config);

    await service.updateFactoryStaff(owner, 'factory-1', 'staff-1', { password: 'NewPass12345' });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ password: 'hashed:NewPass12345', mustChangePassword: true, sessionVersion: { increment: 1 } }),
    }));
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({ where: { userId: 'staff-1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(JSON.stringify(log.record.mock.calls[0][0].changes)).not.toContain('NewPass12345');
  });
});
