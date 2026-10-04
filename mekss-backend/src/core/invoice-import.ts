import { BadRequestException } from '@nestjs/common';
import { InvoiceCategory, InvoiceItemType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { isValidJalaaliDate, toGregorian, toJalaali } from 'jalaali-js';
import { calendarDaysLate, MAX_INVOICE_AMOUNT, money, sumItems } from './invoice-billing';

export const IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 2000;

export type ImportTarget = 'FACTORY' | 'PARK';

type ColumnSpec =
  | { key: 'target'; header: string; width: number }
  | { key: 'item'; header: string; width: number; type: InvoiceItemType }
  | { key: 'otherTitle' | 'dueDate' | 'penalty' | 'description'; header: string; width: number };

export type ParsedImportRow = {
  rowNumber: number;
  key: string;
  items: Array<{ type: InvoiceItemType; title: string | null; amount: number }>;
  total: number;
  dueDate: string | null;
  dueDateJalali: string | null;
  latePenaltyPerDay: number;
  description: string | null;
  errors: string[];
};

const TARGET_HEADERS: Record<ImportTarget, string> = {
  FACTORY: 'شناسه ملی واحد',
  PARK: 'نام دقیق شهرک',
};

export function importColumns(category: InvoiceCategory, target: ImportTarget): ColumnSpec[] {
  const itemColumns: ColumnSpec[] = category === InvoiceCategory.PLATFORM
    ? [
      { key: 'item', header: 'ورودی', width: 16, type: InvoiceItemType.ENTRANCE_FEE },
      { key: 'item', header: 'حق عضویت ماهانه', width: 18, type: InvoiceItemType.MONTHLY_MEMBERSHIP },
      { key: 'item', header: 'سایر', width: 14, type: InvoiceItemType.PLATFORM_OTHER },
    ]
    : [
      { key: 'item', header: 'آب‌بها', width: 14, type: InvoiceItemType.WATER },
      { key: 'item', header: 'فاضلاب‌بها', width: 14, type: InvoiceItemType.SEWAGE },
      { key: 'item', header: 'سهم نوسازی، بازسازی و تعمیرات', width: 26, type: InvoiceItemType.RENOVATION_SHARE },
      { key: 'item', header: 'بدهی سهام', width: 14, type: InvoiceItemType.SHARE_DEBT },
      { key: 'item', header: 'سایر', width: 14, type: InvoiceItemType.CHARGE_OTHER },
    ];
  return [
    { key: 'target', header: TARGET_HEADERS[target], width: target === 'PARK' ? 28 : 18 },
    ...itemColumns,
    { key: 'otherTitle', header: 'عنوان سایر', width: 22 },
    { key: 'dueDate', header: 'مهلت پرداخت (شمسی)', width: 20 },
    { key: 'penalty', header: 'جریمه روزانه (ریال)', width: 18 },
    { key: 'description', header: 'توضیحات', width: 30 },
  ];
}

export async function buildImportTemplate(category: InvoiceCategory, target: ImportTarget): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MEKSS';
  const sheet = workbook.addWorksheet('قبوض', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  const columns = importColumns(category, target);
  sheet.columns = columns.map((column) => ({ header: column.header, width: column.width }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  header.height = 30;
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  });

  const due = new Date(Date.now() + 30 * 86_400_000);
  const { jy, jm, jd } = toJalaali(due.getUTCFullYear(), due.getUTCMonth() + 1, due.getUTCDate());
  const sampleDate = `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
  const sample = columns.map((column) => {
    switch (column.key) {
      case 'target': return target === 'PARK' ? 'شهرک صنعتی نمونه' : '10101010101';
      case 'item': return column.type === InvoiceItemType.WATER || column.type === InvoiceItemType.MONTHLY_MEMBERSHIP ? 1500000 : null;
      case 'otherTitle': return null;
      case 'dueDate': return sampleDate;
      case 'penalty': return 0;
      case 'description': return 'ردیف نمونه — قبل از ثبت حذف شود';
      default: return null;
    }
  });
  sheet.addRow(sample);
  for (let row = 2; row <= 2001; row += 1) {
    const targetCell = sheet.getCell(row, 1);
    targetCell.numFmt = '@';
    const dueCell = sheet.getCell(row, columns.findIndex((column) => column.key === 'dueDate') + 1);
    dueCell.numFmt = '@';
    columns.forEach((column, index) => {
      if (column.key === 'item' || column.key === 'penalty') sheet.getCell(row, index + 1).numFmt = '#,##0';
    });
  }

  const help = workbook.addWorksheet('راهنما', { views: [{ rightToLeft: true }] });
  help.columns = [{ width: 110 }];
  [
    'راهنمای تکمیل فایل قبوض',
    target === 'PARK'
      ? '• ستون «نام دقیق شهرک» باید دقیقاً با نام ثبت‌شدهٔ شهرک در سامانه یکسان باشد.'
      : '• ستون «شناسه ملی واحد» شناسهٔ ملی ۱۱ رقمی واحد صنعتی ثبت‌شده در سامانه است.',
    '• مبالغ به ریال وارد شوند؛ ارقام فارسی و جداکنندهٔ هزارگان مجاز است. ستون‌های بدون مبلغ خالی بمانند.',
    '• هر ردیف حداقل یک مبلغ بزرگ‌تر از صفر لازم دارد. اگر ستون «سایر» مبلغ دارد، «عنوان سایر» را هم بنویسید.',
    '• مهلت پرداخت به تاریخ شمسی (مثل 1405/07/30) و امروز یا بعد از آن باشد.',
    '• جریمه روزانه (اختیاری) برای هر روز تأخیر پس از مهلت پرداخت محاسبه می‌شود.',
    '• هر شناسه فقط یک بار در فایل مجاز است. ردیف نمونه را قبل از ثبت حذف کنید.',
    `• حداکثر ${IMPORT_MAX_ROWS} ردیف و حجم ۲ مگابایت.`,
  ].forEach((line, index) => {
    const row = help.addRow([line]);
    if (index === 0) row.font = { bold: true, size: 14 };
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

const toAsciiDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

const normalizeHeader = (value: string) =>
  toAsciiDigits(value).replace(/[\u200c\u200f\u200e\s]+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();

function cellPrimitive(value: ExcelJS.CellValue): string | number | Date | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
    if ('result' in value) return cellPrimitive((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('text' in value) return String((value as { text: unknown }).text ?? '');
    if ('error' in value) return null;
    return null;
  }
  return value as string | number | boolean;
}

function cellText(value: ExcelJS.CellValue): string {
  const primitive = cellPrimitive(value);
  if (primitive === null) return '';
  if (primitive instanceof Date) return primitive.toISOString();
  return toAsciiDigits(String(primitive)).trim();
}

/** Parses an amount cell; returns null for blank and NaN for garbage. */
export function parseAmount(value: ExcelJS.CellValue): number | null {
  const primitive = cellPrimitive(value);
  if (primitive === null || primitive === '') return null;
  if (typeof primitive === 'number') return primitive;
  if (typeof primitive !== 'string') return Number.NaN;
  const cleaned = toAsciiDigits(primitive).replace(/[,٬،\s]/g, '').replace(/ریال$/, '');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

/** Jalali text (1405/07/30), Gregorian text (2026-10-21) or an Excel date cell → UTC-noon Date. */
export function parseDueDate(value: ExcelJS.CellValue): Date | null {
  const primitive = cellPrimitive(value);
  if (primitive === null || primitive === '') return null;
  if (primitive instanceof Date) {
    return new Date(Date.UTC(primitive.getUTCFullYear(), primitive.getUTCMonth(), primitive.getUTCDate(), 12));
  }
  const text = toAsciiDigits(String(primitive)).trim();
  const match = text.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1700) {
    if (!isValidJalaaliDate(year, month, day)) return null;
    const { gy, gm, gd } = toGregorian(year, month, day);
    return new Date(Date.UTC(gy, gm - 1, gd, 12));
  }
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function jalaliText(date: Date): string {
  const { jy, jm, jd } = toJalaali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

export async function parseImportWorkbook(
  buffer: Buffer,
  category: InvoiceCategory,
  target: ImportTarget,
  now: Date = new Date(),
): Promise<ParsedImportRow[]> {
  if (!buffer?.length) throw new BadRequestException('فایل خالی است');
  if (buffer.length > IMPORT_MAX_FILE_BYTES) throw new BadRequestException('حجم فایل بیش از ۲ مگابایت است');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestException('فایل اکسل معتبر نیست؛ از قالب xlsx سامانه استفاده کنید');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new BadRequestException('فایل اکسل هیچ برگه‌ای ندارد');

  const columns = importColumns(category, target);
  const headerRow = sheet.getRow(1);
  const headerIndex = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = normalizeHeader(cellText(cell.value));
    if (text && !headerIndex.has(text)) headerIndex.set(text, colNumber);
  });
  const ownHeaders = new Set(columns.map((column) => normalizeHeader(column.header)));
  const otherCategory = category === InvoiceCategory.PLATFORM ? InvoiceCategory.CHARGE : InvoiceCategory.PLATFORM;
  const foreignItemHeaders = importColumns(otherCategory, target)
    .filter((column) => column.key === 'item' && !ownHeaders.has(normalizeHeader(column.header)))
    .map((column) => column.header)
    .filter((header) => headerIndex.has(normalizeHeader(header)));
  if (foreignItemHeaders.length) {
    throw new BadRequestException(
      `این فایل قالب ${category === InvoiceCategory.PLATFORM ? 'قبض شارژ' : 'صورتحساب سامانه'} است (ستون‌های ${foreignItemHeaders.join('، ')}). قالب مخصوص خودتان را دانلود کنید.`,
    );
  }
  const positions = columns.map((column) => headerIndex.get(normalizeHeader(column.header)));
  const missing = columns.filter((column, index) => positions[index] === undefined && (column.key === 'target' || column.key === 'dueDate'));
  if (missing.length) {
    throw new BadRequestException(`ستون‌های الزامی در فایل پیدا نشد: ${missing.map((column) => column.header).join('، ')}. قالب را دوباره دانلود کنید.`);
  }
  if (!columns.some((column, index) => column.key === 'item' && positions[index] !== undefined)) {
    throw new BadRequestException('هیچ ستون مبلغی در فایل پیدا نشد. قالب را دوباره دانلود کنید.');
  }

  const rows: ParsedImportRow[] = [];
  const seenKeys = new Map<string, number>();
  const lastRow = sheet.actualRowCount ? sheet.lastRow?.number ?? 1 : 1;
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const value = (index: number) => {
      const position = positions[index];
      return position === undefined ? null : row.getCell(position).value;
    };
    const hasContent = positions.some((position) => position !== undefined && cellText(row.getCell(position).value) !== '');
    if (!hasContent) continue;
    if (rows.length >= IMPORT_MAX_ROWS) throw new BadRequestException(`حداکثر ${IMPORT_MAX_ROWS} ردیف در هر فایل مجاز است`);

    const errors: string[] = [];
    let key = '';
    let otherTitle = '';
    let dueDate = null as Date | null;
    let dueRaw = '';
    let penalty = 0;
    let description = null as string | null;
    const items: ParsedImportRow['items'] = [];

    columns.forEach((column, index) => {
      const raw = value(index);
      if (column.key === 'target') {
        if (target === 'FACTORY') {
          key = cellText(raw).replace(/\D/g, '');
          // Numeric cells drop leading zeros of 10-digit IDs.
          if (typeof cellPrimitive(raw) === 'number' && key.length > 0 && key.length < 10) key = key.padStart(10, '0');
        } else {
          key = cellText(raw).replace(/\s+/g, ' ');
        }
      } else if (column.key === 'item') {
        const amount = parseAmount(raw);
        if (amount === null || amount === 0) return;
        if (!Number.isFinite(amount) || amount < 0 || amount > MAX_INVOICE_AMOUNT) {
          errors.push(`مبلغ «${column.header}» نامعتبر است`);
          return;
        }
        items.push({ type: column.type, title: null, amount: money(amount) });
      } else if (column.key === 'otherTitle') {
        otherTitle = cellText(raw).slice(0, 200);
      } else if (column.key === 'dueDate') {
        dueRaw = cellText(raw);
        dueDate = parseDueDate(raw);
      } else if (column.key === 'penalty') {
        const amount = parseAmount(raw);
        if (amount === null) return;
        if (!Number.isFinite(amount) || amount < 0 || amount > MAX_INVOICE_AMOUNT) errors.push('جریمه روزانه نامعتبر است');
        else penalty = money(amount);
      } else if (column.key === 'description') {
        const text = cellText(raw);
        description = text ? text.slice(0, 2000) : null;
      }
    });

    if (!key) errors.push(target === 'FACTORY' ? 'شناسه ملی واحد خالی است' : 'نام شهرک خالی است');
    else if (target === 'FACTORY' && !/^\d{10,11}$/.test(key)) errors.push('شناسه ملی واحد باید ۱۰ یا ۱۱ رقم باشد');
    if (key) {
      const normalizedKey = key.replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase();
      const firstRow = seenKeys.get(normalizedKey);
      if (firstRow !== undefined) errors.push(`شناسه تکراری (قبلاً در ردیف ${firstRow} آمده است)`);
      else seenKeys.set(normalizedKey, rowNumber);
    }
    const other = items.find((item) => item.type === InvoiceItemType.CHARGE_OTHER || item.type === InvoiceItemType.PLATFORM_OTHER);
    if (other) {
      if (!otherTitle) errors.push('برای مبلغ «سایر»، «عنوان سایر» لازم است');
      else other.title = otherTitle;
    }
    if (!items.length && !errors.some((error) => error.startsWith('مبلغ'))) errors.push('حداقل یک مبلغ بزرگ‌تر از صفر لازم است');
    if (sumItems(items) > MAX_INVOICE_AMOUNT) errors.push('جمع مبالغ ردیف بیش از حد مجاز است');
    if (!dueRaw) errors.push('مهلت پرداخت خالی است');
    else if (!dueDate) errors.push(`مهلت پرداخت «${dueRaw}» معتبر نیست (نمونه: 1405/07/30)`);
    else if (calendarDaysLate(dueDate, now) > 0) errors.push('مهلت پرداخت باید امروز یا بعد از آن باشد');

    const resolvedDue = dueDate;
    rows.push({
      rowNumber,
      key,
      items,
      total: sumItems(items),
      dueDate: resolvedDue ? resolvedDue.toISOString() : null,
      dueDateJalali: resolvedDue ? jalaliText(resolvedDue) : null,
      latePenaltyPerDay: penalty,
      description,
      errors,
    });
  }
  if (!rows.length) throw new BadRequestException('هیچ ردیف داده‌ای در فایل پیدا نشد');
  return rows;
}
