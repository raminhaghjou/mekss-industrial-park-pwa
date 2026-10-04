import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EmergencyStatus, FactoryStatus, InvoiceCategory, InvoiceItemType, InvoiceStatus, Role } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { toJalaali } from 'jalaali-js';

jest.mock('bcrypt', () => ({ hash: jest.fn(async (value: string) => `hashed:${value}`) }));
// Building and parsing real .xlsx workbooks with ExcelJS can exceed the 5 s default on loaded CI machines.
jest.setTimeout(30_000);

import { resolveActiveFactoryId } from './auth.guard';
import { calendarDaysLate, normalizeInvoiceItems, splitEvenly } from './invoice-billing';
import { importColumns, parseImportWorkbook } from './invoice-import';
import { ManagementService } from './management.service';

const actor = (role: Role = Role.PARK_MANAGER, extra: Record<string, unknown> = {}) => ({ id: 'actor-1', role, phoneNumber: '09120000000', ...extra });
const config = { get: jest.fn((_key: string, fallback?: string) => fallback) } as any;

const today = new Date();
const daysFromNow = (days: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days, 12));
const jalali = (date: Date) => {
  const { jy, jm, jd } = toJalaali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
};

const invoiceRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  invoiceNumber: 'INV-1',
  targetType: 'FACTORY',
  category: InvoiceCategory.CHARGE,
  factoryId: 'factory-1',
  parkId: 'park-1',
  createdById: 'actor-1',
  amount: 1_000_000,
  taxAmount: 0,
  discountAmount: 0,
  totalAmount: 1_000_000,
  latePenaltyPerDay: 10_000,
  lateDays: 0,
  latePenaltyAmount: 0,
  dueDate: daysFromNow(5),
  penaltyStartsAt: null,
  status: InvoiceStatus.PENDING,
  parentInvoiceId: null,
  description: 'قبض شارژ',
  paymentDate: null,
  items: [],
  ...overrides,
});

/** Prisma double for invoice operations; `$transaction` reuses the same client. */
const invoicePrisma = (existing: Record<string, unknown>, managedParks: string[] = ['park-1']) => {
  const prisma: any = {
    invoice: {
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn(async ({ data }) => ({ ...existing, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(async ({ data }) => ({ id: `child-${data.installmentNo ?? 'x'}`, ...data, items: data.items?.create ?? [] })),
      findUniqueOrThrow: jest.fn(async () => ({ ...existing, status: InvoiceStatus.PAID })),
      count: jest.fn().mockResolvedValue(0),
    },
    invoiceItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    invoiceAdjustment: { create: jest.fn().mockResolvedValue({}) },
    paymentTransaction: { count: jest.fn().mockResolvedValue(0) },
    factory: { count: jest.fn().mockResolvedValue(1), findUnique: jest.fn().mockResolvedValue({ managerId: 'owner-1' }) },
    industrialPark: { findMany: jest.fn().mockResolvedValue(managedParks.map((id) => ({ id }))) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction = jest.fn((callback: any) => callback(prisma));
  return prisma;
};
const serviceFor = (prisma: any) => new ManagementService(prisma, { record: jest.fn().mockResolvedValue(undefined) } as any, config);

describe('invoice billing helpers', () => {
  it('splits into whole-Rial installments with the remainder on the last one', () => {
    expect(splitEvenly(1_000_000, 3)).toEqual([333_333, 333_333, 333_334]);
    expect(splitEvenly(100, 2)).toEqual([50, 50]);
  });

  it('only allows the item types of the bill category and requires a title for "other"', () => {
    expect(normalizeInvoiceItems([{ type: 'WATER', amount: 100 }, { type: 'CHARGE_OTHER', title: ' نگهبانی ', amount: 50 }], InvoiceCategory.CHARGE))
      .toEqual([
        { type: 'WATER', title: null, amount: 100, sortOrder: 0 },
        { type: 'CHARGE_OTHER', title: 'نگهبانی', amount: 50, sortOrder: 1 },
      ]);
    expect(() => normalizeInvoiceItems([{ type: 'ENTRANCE_FEE', amount: 100 }], InvoiceCategory.CHARGE)).toThrow(BadRequestException);
    expect(() => normalizeInvoiceItems([{ type: 'WATER', amount: 100 }], InvoiceCategory.PLATFORM)).toThrow(BadRequestException);
    expect(() => normalizeInvoiceItems([{ type: 'CARRIED_PENALTY', amount: 100 }], InvoiceCategory.CHARGE)).toThrow(BadRequestException);
    expect(() => normalizeInvoiceItems([{ type: 'CHARGE_OTHER', amount: 100 }], InvoiceCategory.CHARGE)).toThrow(BadRequestException);
  });

  it('counts calendar days late and never treats the due day itself as late', () => {
    expect(calendarDaysLate(daysFromNow(0))).toBe(0);
    expect(calendarDaysLate(daysFromNow(3))).toBe(0);
    expect(calendarDaysLate(daysFromNow(-4))).toBe(4);
  });
});

const buildWorkbook = async (category: InvoiceCategory, target: 'FACTORY' | 'PARK', rows: Array<Record<string, unknown>>) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('قبوض');
  const columns = importColumns(category, target);
  sheet.addRow(columns.map((column) => column.header));
  for (const row of rows) sheet.addRow(columns.map((column) => row[column.header] ?? null));
  return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
};

describe('Excel invoice import parser', () => {
  it('parses Persian digits, Jalali dates and reports row-level errors', async () => {
    const due = jalali(daysFromNow(10));
    const buffer = await buildWorkbook(InvoiceCategory.CHARGE, 'FACTORY', [
      { 'شناسه ملی واحد': '10000000001', 'آب‌بها': '۱٬۰۰۰٬۰۰۰', 'مهلت پرداخت (شمسی)': due, 'جریمه روزانه (ریال)': 5000 },
      { 'شناسه ملی واحد': '10000000002', 'سایر': 200000, 'مهلت پرداخت (شمسی)': due },
      { 'شناسه ملی واحد': '10000000001', 'فاضلاب‌بها': 1000, 'مهلت پرداخت (شمسی)': due },
      { 'شناسه ملی واحد': 123, 'فاضلاب‌بها': 1000, 'مهلت پرداخت (شمسی)': jalali(daysFromNow(-2)) },
      { 'شناسه ملی واحد': '10000000009', 'مهلت پرداخت (شمسی)': '1405/13/40' },
    ]);

    const rows = await parseImportWorkbook(buffer, InvoiceCategory.CHARGE, 'FACTORY');

    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      key: '10000000001',
      items: [{ type: InvoiceItemType.WATER, amount: 1_000_000 }],
      total: 1_000_000,
      latePenaltyPerDay: 5000,
      dueDateJalali: due,
      errors: [],
    });
    expect(rows[1].errors).toEqual(['برای مبلغ «سایر»، «عنوان سایر» لازم است']);
    expect(rows[2].errors[0]).toContain('شناسه تکراری');
    expect(rows[3].key).toBe('0000000123');
    expect(rows[3].errors).toEqual(['مهلت پرداخت باید امروز یا بعد از آن باشد']);
    expect(rows[4].errors).toEqual(expect.arrayContaining(['حداقل یک مبلغ بزرگ‌تر از صفر لازم است', expect.stringContaining('معتبر نیست')]));
  });

  it('rejects files without the required columns', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('x').addRow(['ستون نامعتبر']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
    await expect(parseImportWorkbook(buffer, InvoiceCategory.CHARGE, 'FACTORY')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a template of the other bill category instead of silently dropping its amounts', async () => {
    const due = jalali(daysFromNow(10));
    const platformFile = await buildWorkbook(InvoiceCategory.PLATFORM, 'FACTORY', [
      { 'شناسه ملی واحد': '10000000001', 'ورودی': 1000, 'مهلت پرداخت (شمسی)': due },
    ]);
    await expect(parseImportWorkbook(platformFile, InvoiceCategory.CHARGE, 'FACTORY')).rejects.toThrow('قالب صورتحساب سامانه');
  });

  it('treats Arabic and Persian spellings of a park name as the same duplicate key', async () => {
    const due = jalali(daysFromNow(10));
    const buffer = await buildWorkbook(InvoiceCategory.PLATFORM, 'PARK', [
      { 'نام دقیق شهرک': 'شهرک يك', 'ورودی': 1000, 'مهلت پرداخت (شمسی)': due },
      { 'نام دقیق شهرک': 'شهرک یک', 'ورودی': 1000, 'مهلت پرداخت (شمسی)': due },
    ]);
    const rows = await parseImportWorkbook(buffer, InvoiceCategory.PLATFORM, 'PARK');
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors[0]).toContain('شناسه تکراری');
  });
});

describe('ManagementService multi-line invoices and Excel import', () => {
  const factoryPrisma = () => {
    const prisma: any = {
      industrialPark: { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]), findUnique: jest.fn() },
      factory: {
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue({ id: 'factory-1', name: 'واحد', parkId: 'park-1', managerId: 'owner-1', manager: { phoneNumber: '09120000001' } }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'factory-1', name: 'واحد ۱', nationalId: '10000000001', parkId: 'park-1', managerId: 'owner-1', manager: { phoneNumber: '09120000001' } },
          { id: 'factory-2', name: 'واحد ۲', nationalId: '10000000002', parkId: 'park-1', managerId: 'owner-2', manager: { phoneNumber: '09120000002' } },
        ]),
      },
      invoice: { create: jest.fn(async ({ data }) => ({ id: 'inv-new', ...data, items: data.items?.create ?? [] })) },
      invoiceImportBatch: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'batch-1' }) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    return prisma;
  };

  it('issues a charge bill with line items, summing the amount and building a default description', async () => {
    const prisma = factoryPrisma();
    const result = await serviceFor(prisma).createInvoice(actor(Role.PARK_MANAGER), {
      factoryId: 'factory-1',
      dueDate: daysFromNow(10).toISOString(),
      items: [{ type: 'WATER', amount: 1_000_000 }, { type: 'CHARGE_OTHER', title: 'نگهبانی', amount: 500_000 }] as any,
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: InvoiceCategory.CHARGE,
        amount: 1_500_000,
        totalAmount: 1_500_000,
        description: 'قبض شارژ: آب‌بها، نگهبانی',
        items: { create: [
          { type: 'WATER', title: null, amount: 1_000_000, sortOrder: 0 },
          { type: 'CHARGE_OTHER', title: 'نگهبانی', amount: 500_000, sortOrder: 1 },
        ] },
      }),
    }));
    expect(result).toMatchObject({ payableAmount: 1_500_000 });
  });

  it('keeps platform items (entrance fee, membership) for the super admin only', async () => {
    const prisma = factoryPrisma();
    await expect(serviceFor(prisma).createInvoice(actor(Role.PARK_MANAGER), {
      factoryId: 'factory-1', dueDate: daysFromNow(10).toISOString(), items: [{ type: 'ENTRANCE_FEE', amount: 1000 }] as any,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.invoice.create).not.toHaveBeenCalled();

    prisma.industrialPark.findUnique.mockResolvedValue({ id: 'park-1', name: 'شهرک', managers: [] });
    await serviceFor(prisma).createInvoice(actor(Role.SUPER_ADMIN), {
      targetType: 'PARK', parkId: 'park-1', dueDate: daysFromNow(10).toISOString(), items: [{ type: 'MONTHLY_MEMBERSHIP', amount: 2000 }] as any,
    });
    expect(prisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ category: InvoiceCategory.PLATFORM, targetType: 'PARK', invoiceNumber: expect.stringMatching(/^PINV-/) }),
    }));
  });

  it('previews an import, flags unknown units, and commits nothing while any row is invalid', async () => {
    const due = jalali(daysFromNow(10));
    const buffer = await buildWorkbook(InvoiceCategory.CHARGE, 'FACTORY', [
      { 'شناسه ملی واحد': '10000000001', 'آب‌بها': 1000, 'مهلت پرداخت (شمسی)': due },
      { 'شناسه ملی واحد': '10000000077', 'آب‌بها': 1000, 'مهلت پرداخت (شمسی)': due },
    ]);
    const prisma = factoryPrisma();
    const service = serviceFor(prisma);

    const preview: any = await service.importInvoices(actor(Role.PARK_MANAGER), { buffer, originalname: 'a.xlsx' }, { dryRun: true });
    expect(preview.summary).toEqual({ rowCount: 2, validCount: 1, errorCount: 1, totalAmount: 1000 });
    expect(preview.rows[0]).toMatchObject({ targetId: 'factory-1', errors: [] });
    expect(preview.rows[1].errors).toEqual(['واحدی با این شناسه ملی پیدا نشد یا در محدودهٔ شما نیست']);
    expect(prisma.factory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { nationalId: { in: ['10000000001', '10000000077'] }, parkId: { in: ['park-1'] } },
    }));

    await expect(service.importInvoices(actor(Role.PARK_MANAGER), { buffer }, { dryRun: false })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('commits a valid import atomically with a batch and refuses to import the same file twice', async () => {
    const due = jalali(daysFromNow(10));
    const buffer = await buildWorkbook(InvoiceCategory.CHARGE, 'FACTORY', [
      { 'شناسه ملی واحد': '10000000001', 'آب‌بها': 1000, 'مهلت پرداخت (شمسی)': due },
      { 'شناسه ملی واحد': '10000000002', 'بدهی سهام': 2500, 'مهلت پرداخت (شمسی)': due, 'جریمه روزانه (ریال)': 100 },
    ]);
    const prisma = factoryPrisma();
    const service = serviceFor(prisma);

    await expect(service.importInvoices(actor(Role.PARK_MANAGER), { buffer, originalname: 'b.xlsx' }, { dryRun: false }))
      .resolves.toMatchObject({ dryRun: false, batchId: 'batch-1', created: 2, totalAmount: 3500 });
    expect(prisma.invoiceImportBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ createdById: 'actor-1', fileHash: expect.stringMatching(/^[a-f0-9]{64}$/), category: InvoiceCategory.CHARGE, rowCount: 2 }),
    });
    expect(prisma.invoice.create).toHaveBeenCalledTimes(2);
    expect(prisma.invoice.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ factoryId: 'factory-2', importBatchId: 'batch-1', amount: 2500, latePenaltyPerDay: 100 }),
    }));

    prisma.invoiceImportBatch.findUnique.mockResolvedValue({ id: 'batch-1', createdAt: new Date(), rowCount: 2 });
    await expect(service.importInvoices(actor(Role.PARK_MANAGER), { buffer }, { dryRun: true })).resolves.toMatchObject({ alreadyImported: true });
    await expect(service.importInvoices(actor(Role.PARK_MANAGER), { buffer }, { dryRun: false })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.invoice.create).toHaveBeenCalledTimes(2);
  });

  it('lets only super admins import park bills', async () => {
    const buffer = await buildWorkbook(InvoiceCategory.CHARGE, 'FACTORY', []);
    await expect(serviceFor(factoryPrisma()).importInvoices(actor(Role.PARK_MANAGER), { buffer }, { dryRun: true, target: 'PARK' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(serviceFor(factoryPrisma()).importInvoices(actor(Role.FACTORY_OWNER), { buffer }, { dryRun: true }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ManagementService invoice financial operations', () => {
  it('lets only the issuer edit, and never reduces the daily penalty once it has started', async () => {
    const late = invoiceRow({ status: InvoiceStatus.OVERDUE, dueDate: daysFromNow(-3) });
    await expect(serviceFor(invoicePrisma({ ...late, createdById: 'someone-else' })).updateInvoice(actor(), 'inv-1', { description: 'x' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(serviceFor(invoicePrisma(late)).updateInvoice(actor(), 'inv-1', { latePenaltyPerDay: 1000 }))
      .rejects.toBeInstanceOf(BadRequestException);

    // cancel → lower the rate → reopen must not erase the accrued penalty either
    const cancelledLate = invoiceRow({ status: InvoiceStatus.CANCELLED, dueDate: daysFromNow(-3) });
    await expect(serviceFor(invoicePrisma(cancelledLate)).updateInvoice(actor(), 'inv-1', { latePenaltyPerDay: 0, status: 'PENDING' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses edits, discounts and extensions while an online payment is in flight', async () => {
    const busy = invoicePrisma(invoiceRow());
    busy.paymentTransaction.count.mockResolvedValue(1);
    const service = serviceFor(busy);
    await expect(service.updateInvoice(actor(), 'inv-1', { description: 'x' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.discountInvoice(actor(), 'inv-1', { discountAmount: 1 })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.extendInvoiceDueDate(actor(), 'inv-1', { dueDate: daysFromNow(30).toISOString() })).rejects.toBeInstanceOf(ConflictException);
    expect(busy.invoice.update).not.toHaveBeenCalled();
  });

  it('rejects a total above the storable maximum', async () => {
    await expect(serviceFor(invoicePrisma(invoiceRow())).updateInvoice(actor(), 'inv-1', { amount: 9_999_999_999_999, taxAmount: 1 }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps a carried penalty row when the issuer edits the line items', async () => {
    const existing = invoiceRow({
      amount: 540_000,
      totalAmount: 540_000,
      items: [
        { type: InvoiceItemType.WATER, title: null, amount: 500_000 },
        { type: InvoiceItemType.CARRIED_PENALTY, title: 'جریمه تأخیر قبلی', amount: 40_000 },
      ],
    });
    const prisma = invoicePrisma(existing);
    await serviceFor(prisma).updateInvoice(actor(), 'inv-1', { items: [{ type: 'WATER', amount: 600_000 }] as any });

    expect(prisma.invoiceItem.createMany).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ type: InvoiceItemType.WATER, amount: 600_000, sortOrder: 0 }),
      expect.objectContaining({ type: InvoiceItemType.CARRIED_PENALTY, amount: 40_000, sortOrder: 1 }),
    ] });
    expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: 640_000, totalAmount: 640_000 }) }));
    expect(prisma.invoiceAdjustment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'EDIT' }) });
  });

  it('applies a discount to the base only and never to the late penalty', async () => {
    const prisma = invoicePrisma(invoiceRow({ status: InvoiceStatus.OVERDUE, dueDate: daysFromNow(-2) }));
    const service = serviceFor(prisma);
    await expect(service.discountInvoice(actor(), 'inv-1', { discountAmount: 1_000_001 })).rejects.toBeInstanceOf(BadRequestException);

    const result: any = await service.discountInvoice(actor(), 'inv-1', { discountAmount: 100_000, note: 'توافق' });
    expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: { discountAmount: 100_000, totalAmount: 900_000 } }));
    expect(result).toMatchObject({ discountAmount: 100_000, totalAmount: 900_000, latePenaltyAmount: 20_000, payableAmount: 920_000 });
    expect(prisma.invoiceAdjustment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'DISCOUNT', amount: 100_000, note: 'توافق' }) });

    const carried = invoicePrisma(invoiceRow({
      amount: 1_040_000,
      totalAmount: 1_040_000,
      items: [{ type: InvoiceItemType.CARRIED_PENALTY, amount: 40_000 }],
    }));
    await expect(serviceFor(carried).discountInvoice(actor(), 'inv-1', { discountAmount: 1_040_000 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(serviceFor(carried).discountInvoice(actor(), 'inv-1', { discountAmount: 1_000_000 })).resolves.toMatchObject({ totalAmount: 40_000 });
  });

  it('allows other managers of the same park on charge bills and super admins on platform bills only', async () => {
    const chargeByOther = invoiceRow({ createdById: 'manager-2' });
    await expect(serviceFor(invoicePrisma(chargeByOther, ['park-1'])).discountInvoice(actor(), 'inv-1', { discountAmount: 1 })).resolves.toBeDefined();
    await expect(serviceFor(invoicePrisma(chargeByOther, ['park-9'])).discountInvoice(actor(), 'inv-1', { discountAmount: 1 }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(serviceFor(invoicePrisma(chargeByOther)).discountInvoice(actor(Role.SUPER_ADMIN), 'inv-1', { discountAmount: 1 }))
      .rejects.toBeInstanceOf(ForbiddenException);

    const platformByOther = invoiceRow({ createdById: 'admin-2', category: InvoiceCategory.PLATFORM });
    await expect(serviceFor(invoicePrisma(platformByOther)).discountInvoice(actor(Role.SUPER_ADMIN), 'inv-1', { discountAmount: 1 })).resolves.toBeDefined();
    await expect(serviceFor(invoicePrisma(platformByOther)).discountInvoice(actor(), 'inv-1', { discountAmount: 1 }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(serviceFor(invoicePrisma(chargeByOther)).discountInvoice(actor(Role.FACTORY_OWNER), 'inv-1', { discountAmount: 1 }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps accruing the penalty from the original start when an overdue bill is extended', async () => {
    const originalDue = daysFromNow(-5);
    const prisma = invoicePrisma(invoiceRow({ status: InvoiceStatus.OVERDUE, dueDate: originalDue }));
    const result: any = await serviceFor(prisma).extendInvoiceDueDate(actor(), 'inv-1', { dueDate: daysFromNow(10).toISOString() });

    expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { dueDate: daysFromNow(10), penaltyStartsAt: originalDue, status: InvoiceStatus.PENDING },
    }));
    expect(result).toMatchObject({ status: InvoiceStatus.PENDING, lateDays: 5, latePenaltyAmount: 50_000, payableAmount: 1_050_000 });
    expect(prisma.invoiceAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'EXTENSION', fromDueDate: originalDue, details: expect.objectContaining({ accruedLateDays: 5, accruedLatePenalty: 50_000 }) }),
    });
  });

  it('keeps the first penalty start across repeated extensions and starts none for bills that are not late', async () => {
    const firstStart = daysFromNow(-6);
    const extendedAgain = invoicePrisma(invoiceRow({ dueDate: daysFromNow(3), penaltyStartsAt: firstStart }));
    await serviceFor(extendedAgain).extendInvoiceDueDate(actor(), 'inv-1', { dueDate: daysFromNow(20).toISOString() });
    expect(extendedAgain.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ penaltyStartsAt: firstStart }) }));

    const onTime = invoicePrisma(invoiceRow({ dueDate: daysFromNow(2) }));
    await serviceFor(onTime).extendInvoiceDueDate(actor(), 'inv-1', { dueDate: daysFromNow(20).toISOString() });
    expect(onTime.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ penaltyStartsAt: null }) }));

    await expect(serviceFor(invoicePrisma(invoiceRow({ dueDate: daysFromNow(10) }))).extendInvoiceDueDate(actor(), 'inv-1', { dueDate: daysFromNow(5).toISOString() }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('splits into installments, freezes the parent, and carries the accrued penalty on the first installment', async () => {
    const prisma = invoicePrisma(invoiceRow({ status: InvoiceStatus.OVERDUE, dueDate: daysFromNow(-4), createdById: 'manager-2' }));
    const result: any = await serviceFor(prisma).splitInvoiceIntoInstallments(actor(), 'inv-1', {
      count: 3,
      firstDueDate: daysFromNow(1).toISOString(),
      intervalDays: 30,
    });

    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] } },
      data: { status: InvoiceStatus.INSTALLMENTS, lateDays: 4, latePenaltyAmount: 40_000 },
    });
    const children = prisma.invoice.create.mock.calls.map(([call]: any) => call.data);
    expect(children.map((child: any) => child.amount)).toEqual([373_333, 333_333, 333_334]);
    expect(children[0].items.create).toEqual([
      expect.objectContaining({ type: InvoiceItemType.CHARGE_OTHER, amount: 333_333 }),
      expect.objectContaining({ type: InvoiceItemType.CARRIED_PENALTY, amount: 40_000 }),
    ]);
    expect(children.every((child: any) => child.parentInvoiceId === 'inv-1' && child.createdById === 'manager-2')).toBe(true);
    expect(children.map((child: any) => child.installmentNo)).toEqual([1, 2, 3]);
    // 10,000/day on the parent is shared pro rata, so the installments together never accrue more
    expect(children.map((child: any) => child.latePenaltyPerDay)).toEqual([3333.33, 3333.33, 3333.34]);
    expect(result.installments).toHaveLength(3);
  });

  it('rejects custom installment schedules that do not add up and refuses while an online payment is in flight', async () => {
    await expect(serviceFor(invoicePrisma(invoiceRow())).splitInvoiceIntoInstallments(actor(), 'inv-1', {
      installments: [{ amount: 400_000, dueDate: daysFromNow(1).toISOString() }, { amount: 500_000, dueDate: daysFromNow(31).toISOString() }],
    })).rejects.toBeInstanceOf(BadRequestException);

    const busy = invoicePrisma(invoiceRow());
    busy.paymentTransaction.count.mockResolvedValue(1);
    await expect(serviceFor(busy).splitInvoiceIntoInstallments(actor(), 'inv-1', { count: 2, firstDueDate: daysFromNow(1).toISOString() }))
      .rejects.toBeInstanceOf(ConflictException);
    await expect(serviceFor(busy).settleInvoiceManually(actor(), 'inv-1', { method: 'CASH' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('settles manually with the penalty accrued up to the payment date', async () => {
    const prisma = invoicePrisma(invoiceRow({ status: InvoiceStatus.OVERDUE, dueDate: daysFromNow(-2) }));
    await serviceFor(prisma).settleInvoiceManually(actor(), 'inv-1', { method: 'CHECK', reference: 'CHK-77' });

    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] } },
      data: expect.objectContaining({ status: InvoiceStatus.PAID, paymentMethod: 'MANUAL_CHECK', lateDays: 2, latePenaltyAmount: 20_000 }),
    });
    expect(prisma.invoiceAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'SETTLEMENT', amount: 1_020_000, details: expect.objectContaining({ reference: 'CHK-77' }) }),
    });
    await expect(serviceFor(invoicePrisma(invoiceRow({ status: InvoiceStatus.PAID }))).settleInvoiceManually(actor(), 'inv-1', { method: 'CASH' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('marks the split parent paid once the last installment is settled', async () => {
    const prisma = invoicePrisma(invoiceRow({ parentInvoiceId: 'parent-1', installmentNo: 3 }));
    await serviceFor(prisma).settleInvoiceManually(actor(), 'inv-1', { method: 'POS' });
    expect(prisma.invoice.count).toHaveBeenCalledWith({ where: { parentInvoiceId: 'parent-1', status: { not: InvoiceStatus.PAID } } });
    expect(prisma.invoice.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'parent-1', status: InvoiceStatus.INSTALLMENTS },
      data: expect.objectContaining({ status: InvoiceStatus.PAID, paymentMethod: 'INSTALLMENTS' }),
    });
  });

  it('verifies a gateway payment against the base captured at start and never reopens a closed invoice', async () => {
    const transaction = (invoice: Record<string, unknown>) => ({
      id: 'tx-1',
      authority: 'auth-1',
      status: 'INITIATED',
      provider: 'MOCK',
      amount: 1_020_000,
      invoiceId: 'inv-1',
      initiatedById: 'owner-1',
      providerStatus: { baseTotal: 1_000_000, lateDays: 2 },
      invoice,
    });
    const verifyPrisma = (invoice: Record<string, unknown>, claimed: number) => {
      const prisma = invoicePrisma(invoice);
      prisma.paymentTransaction.findUnique = jest.fn().mockResolvedValue(transaction(invoice));
      prisma.paymentTransaction.update = jest.fn().mockResolvedValue({});
      prisma.invoice.updateMany.mockResolvedValue({ count: claimed });
      return prisma;
    };

    // a discount applied after the payment started must not be booked as extra penalty
    const open = verifyPrisma(invoiceRow({ status: InvoiceStatus.OVERDUE, totalAmount: 900_000, discountAmount: 100_000 }), 1);
    await expect(serviceFor(open).verifyPayment('auth-1', 'OK')).resolves.toMatchObject({ status: 'awaiting_confirmation', latePenaltyAmount: 20_000, lateDays: 2 });
    expect(open.invoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'inv-1', status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] } },
      data: expect.objectContaining({ status: InvoiceStatus.AWAITING_CONFIRMATION }),
    }));

    const closed = verifyPrisma(invoiceRow({ status: InvoiceStatus.PAID }), 0);
    await expect(serviceFor(closed).verifyPayment('auth-1', 'OK')).resolves.toMatchObject({ status: 'verified_needs_review' });
    expect(closed.paymentTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'VERIFIED', providerStatus: expect.objectContaining({ invoiceNotOpen: true }) }),
    }));
  });

  it('blocks every operation on a parent that was split into installments', async () => {
    const service = serviceFor(invoicePrisma(invoiceRow({ status: InvoiceStatus.INSTALLMENTS })));
    await expect(service.discountInvoice(actor(), 'inv-1', { discountAmount: 1 })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.extendInvoiceDueDate(actor(), 'inv-1', { dueDate: daysFromNow(30).toISOString() })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.updateInvoice(actor(), 'inv-1', { description: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ManagementService factory suspension', () => {
  const suspensionPrisma = (status: FactoryStatus) => ({
    industrialPark: { findMany: jest.fn().mockResolvedValue([{ id: 'park-1' }]) },
    factory: {
      findFirst: jest.fn().mockResolvedValue({ id: 'factory-1', name: 'واحد', status, isApproved: true, managerId: 'owner-1', manager: { phoneNumber: '09120000001' } }),
      update: jest.fn(async ({ data }) => ({ id: 'factory-1', ...data })),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
  }) as any;

  it('requires a reason, suspends, notifies the owner and restores the approved status on unsuspend', async () => {
    const active = suspensionPrisma(FactoryStatus.ACTIVE);
    await expect(serviceFor(active).setFactorySuspended(actor(), 'factory-1', true, '  ')).rejects.toBeInstanceOf(BadRequestException);
    await serviceFor(active).setFactorySuspended(actor(), 'factory-1', true, 'بدهی معوق');
    expect(active.factory.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: FactoryStatus.SUSPENDED, suspendedReason: 'بدهی معوق', suspendedAt: expect.any(Date) },
    }));
    expect(active.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'owner-1', type: 'WARNING' }) });

    const suspended = suspensionPrisma(FactoryStatus.SUSPENDED);
    await serviceFor(suspended).setFactorySuspended(actor(), 'factory-1', false);
    expect(suspended.factory.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: FactoryStatus.ACTIVE, suspendedReason: null, suspendedAt: null },
    }));
    await expect(serviceFor(suspended).setFactorySuspended(actor(), 'factory-1', true, 'x')).rejects.toBeInstanceOf(ConflictException);

    const inactive = suspensionPrisma(FactoryStatus.INACTIVE);
    await expect(serviceFor(inactive).setFactorySuspended(actor(), 'factory-1', true, 'بدهی')).rejects.toBeInstanceOf(ConflictException);
    expect(inactive.factory.update).not.toHaveBeenCalled();
  });

  it('blocks new requests and staff for a suspended unit', async () => {
    const prisma = {
      factory: {
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue({ id: 'factory-1', name: 'واحد', parkId: 'park-1', managerId: 'actor-1', status: FactoryStatus.SUSPENDED, suspendedReason: 'بدهی' }),
      },
      request: { create: jest.fn() },
      user: { create: jest.fn() },
    } as any;
    const service = serviceFor(prisma);
    await expect(service.createRequest(actor(Role.FACTORY_OWNER), { factoryId: 'factory-1', type: 'OTHER', title: 'درخواست', description: 'شرح درخواست' }))
      .rejects.toThrow('مسدود');
    await expect(service.createFactoryStaff(actor(Role.FACTORY_OWNER), 'factory-1', { phoneNumber: '09123334455', name: 'کارمند', password: 'Password1234' } as any))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.request.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('ManagementService fire alarm resolution', () => {
  const alarmPrisma = (managedParks: string[] = [], overrides: Record<string, unknown> = {}) => ({
    emergencyAlert: {
      findUnique: jest.fn().mockResolvedValue({ id: 'em-1', title: 'حریق', parkId: 'park-1', createdById: 'reporter-1', status: EmergencyStatus.OPEN, ...overrides }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'em-1', status: EmergencyStatus.RESOLVED }),
    },
    industrialPark: {
      findMany: jest.fn().mockResolvedValue(managedParks.map((id) => ({ id }))),
      findUnique: jest.fn().mockResolvedValue({ guardPhone: null, phoneNumber: null }),
    },
    factory: { findMany: jest.fn().mockResolvedValue([{ id: 'factory-1', parkId: 'park-1', managerId: 'reporter-1' }]) },
    securityGuard: { findMany: jest.fn().mockResolvedValue([{ parkId: 'park-1', user: { id: 'guard-1', phoneNumber: '0912', isActive: true, isApproved: true } }]) },
    user: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue({ employeeOfParkId: 'park-1' }) },
    notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  }) as any;

  it('lets the reporter, a manager of that park and the super admin stop the alarm', async () => {
    const reporter = { id: 'reporter-1', role: Role.FACTORY_OWNER, phoneNumber: '0912' };
    for (const [who, prisma] of [
      [reporter, alarmPrisma()],
      [actor(Role.PARK_MANAGER), alarmPrisma(['park-1'])],
      [actor(Role.SUPER_ADMIN), alarmPrisma()],
    ] as const) {
      await serviceFor(prisma).emergencyAction(who as any, 'em-1', 'resolve', ' مهار شد ');
      expect(prisma.emergencyAlert.updateMany).toHaveBeenCalledWith({
        where: { id: 'em-1', status: { not: EmergencyStatus.RESOLVED } },
        data: expect.objectContaining({ status: EmergencyStatus.RESOLVED, resolvedById: (who as any).id, resolutionNote: 'مهار شد' }),
      });
    }
  });

  it('refuses managers of other parks, guards and employees who did not report it', async () => {
    const otherManager = alarmPrisma(['park-2']);
    await expect(serviceFor(otherManager).emergencyAction(actor(Role.PARK_MANAGER), 'em-1', 'resolve')).rejects.toBeInstanceOf(ForbiddenException);
    const guard = alarmPrisma();
    await expect(serviceFor(guard).emergencyAction({ id: 'guard-1', role: Role.SECURITY_GUARD, phoneNumber: '0912' }, 'em-1', 'resolve'))
      .rejects.toBeInstanceOf(ForbiddenException);
    const employee = alarmPrisma();
    await expect(serviceFor(employee).emergencyAction({ id: 'employee-1', role: Role.EMPLOYEE, phoneNumber: '0912' }, 'em-1', 'resolve'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(otherManager.emergencyAlert.updateMany).not.toHaveBeenCalled();
    expect(guard.emergencyAlert.updateMany).not.toHaveBeenCalled();
    expect(employee.emergencyAlert.updateMany).not.toHaveBeenCalled();

    await expect(serviceFor(alarmPrisma()).emergencyAction({ id: 'guard-1', role: Role.SECURITY_GUARD, phoneNumber: '0912' }, 'em-1', 'acknowledge')).resolves.toBeDefined();
  });

  it('rejects resolving twice and exposes canResolve per alert', async () => {
    await expect(serviceFor(alarmPrisma([], { status: EmergencyStatus.RESOLVED })).emergencyAction(actor(Role.SUPER_ADMIN), 'em-1', 'resolve'))
      .rejects.toBeInstanceOf(ConflictException);
    const resolved = alarmPrisma([], { status: EmergencyStatus.RESOLVED });
    await expect(serviceFor(resolved).emergencyAction({ id: 'guard-1', role: Role.SECURITY_GUARD, phoneNumber: '0912' }, 'em-1', 'acknowledge'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(resolved.emergencyAlert.updateMany).not.toHaveBeenCalled();
    const raced = alarmPrisma();
    raced.emergencyAlert.updateMany.mockResolvedValue({ count: 0 });
    await expect(serviceFor(raced).emergencyAction({ id: 'guard-1', role: Role.SECURITY_GUARD, phoneNumber: '0912' }, 'em-1', 'acknowledge'))
      .rejects.toBeInstanceOf(ConflictException);

    const prisma = alarmPrisma(['park-1']);
    prisma.emergencyAlert.findMany = jest.fn().mockResolvedValue([
      { id: 'a', parkId: 'park-1', createdById: 'x', status: EmergencyStatus.OPEN },
      { id: 'b', parkId: 'park-1', createdById: 'x', status: EmergencyStatus.RESOLVED },
    ]);
    await expect(serviceFor(prisma).activeEmergencies(actor(Role.PARK_MANAGER))).resolves.toEqual([
      expect.objectContaining({ id: 'a', canResolve: true }),
      expect.objectContaining({ id: 'b', canResolve: false }),
    ]);
  });
});

describe('ManagementService dashboard banners', () => {
  it('serves active banners of the active factory park with image URLs', async () => {
    const prisma = {
      factory: { findMany: jest.fn().mockResolvedValue([{ parkId: 'park-1' }]) },
      dashboardBanner: { findMany: jest.fn().mockResolvedValue([{ id: 'b1', title: 'بنر', desktopImageId: 'd1', mobileImageId: 'm1', linkUrl: null }]) },
    } as any;
    await expect(serviceFor(prisma).activeBanners(actor(Role.FACTORY_OWNER, { activeFactoryId: 'factory-1' }) as any)).resolves.toEqual([
      expect.objectContaining({ id: 'b1', desktopImageUrl: '/api/v1/files/d1/content', mobileImageUrl: '/api/v1/files/m1/content' }),
    ]);
    expect(prisma.factory.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { managerId: 'actor-1', id: 'factory-1' } }));
    const where = prisma.dashboardBanner.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.AND).toEqual(expect.arrayContaining([{ OR: [{ parkId: null }, { parkId: { in: ['park-1'] } }] }]));
  });

  it('only accepts images uploaded to the banner domain and a valid schedule', async () => {
    const prisma = {
      mediaAsset: { findMany: jest.fn().mockResolvedValue([{ id: 'd1' }]) },
      dashboardBanner: { create: jest.fn() },
      industrialPark: { findUnique: jest.fn() },
    } as any;
    const service = serviceFor(prisma);
    await expect(service.createBanner(actor(Role.SUPER_ADMIN), { title: 'بنر', desktopImageId: 'd1', mobileImageId: 'avatar-1' } as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['d1', 'avatar-1'] }, domain: 'banner' } }));

    prisma.mediaAsset.findMany.mockResolvedValue([{ id: 'd1' }, { id: 'm1' }]);
    await expect(service.createBanner(actor(Role.SUPER_ADMIN), {
      title: 'بنر', desktopImageId: 'd1', mobileImageId: 'm1', startsAt: daysFromNow(5).toISOString(), endsAt: daysFromNow(1).toISOString(),
    } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.dashboardBanner.create).not.toHaveBeenCalled();
  });
});

describe('active factory selection (X-Factory-Id)', () => {
  it('accepts only a factory the owner manages and ignores everything else', async () => {
    const prisma = { factory: { count: jest.fn().mockResolvedValue(1) } } as any;
    const owner = { id: 'owner-1', role: Role.FACTORY_OWNER, phoneNumber: '0912' };
    await expect(resolveActiveFactoryId(prisma, owner, 'factory-1')).resolves.toBe('factory-1');
    expect(prisma.factory.count).toHaveBeenCalledWith({ where: { id: 'factory-1', managerId: 'owner-1' } });

    prisma.factory.count.mockResolvedValue(0);
    await expect(resolveActiveFactoryId(prisma, owner, 'factory-of-someone-else')).resolves.toBeUndefined();

    prisma.factory.count.mockClear();
    await expect(resolveActiveFactoryId(prisma, owner, "x' OR 1=1")).resolves.toBeUndefined();
    await expect(resolveActiveFactoryId(prisma, owner, undefined)).resolves.toBeUndefined();
    await expect(resolveActiveFactoryId(prisma, { ...owner, role: Role.PARK_MANAGER }, 'factory-1')).resolves.toBeUndefined();
    expect(prisma.factory.count).not.toHaveBeenCalled();
  });

  it('narrows factory-scoped queries to the active factory', async () => {
    const prisma = { factory: { count: jest.fn().mockResolvedValue(0) } } as any;
    const service = serviceFor(prisma);
    await expect((service as any).assertFactoryAccess(actor(Role.FACTORY_OWNER, { activeFactoryId: 'factory-2' }), 'factory-1'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.factory.count).toHaveBeenCalledWith({ where: { id: 'factory-1', managerId: 'actor-1', AND: [{ id: 'factory-2' }] } });
  });

  it('keeps an employee confined to their own factory even when another factory id is requested', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ employeeOfFactoryId: 'factory-own' }) },
      factory: { count: jest.fn().mockResolvedValue(0) },
    } as any;
    await expect((serviceFor(prisma) as any).assertFactoryAccess(actor(Role.EMPLOYEE), 'factory-other')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.factory.count).toHaveBeenCalledWith({ where: { id: 'factory-other', AND: [{ id: 'factory-own' }] } });
  });
});
