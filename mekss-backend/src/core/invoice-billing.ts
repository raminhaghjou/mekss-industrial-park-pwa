import { BadRequestException } from '@nestjs/common';
import { InvoiceCategory, InvoiceItemType, Role } from '@prisma/client';
import { toJalaali } from 'jalaali-js';

export const CHARGE_ITEM_TYPES: readonly InvoiceItemType[] = [
  InvoiceItemType.WATER,
  InvoiceItemType.SEWAGE,
  InvoiceItemType.RENOVATION_SHARE,
  InvoiceItemType.SHARE_DEBT,
  InvoiceItemType.CHARGE_OTHER,
];

export const PLATFORM_ITEM_TYPES: readonly InvoiceItemType[] = [
  InvoiceItemType.ENTRANCE_FEE,
  InvoiceItemType.MONTHLY_MEMBERSHIP,
  InvoiceItemType.PLATFORM_OTHER,
];

const OTHER_ITEM_TYPES: readonly InvoiceItemType[] = [InvoiceItemType.CHARGE_OTHER, InvoiceItemType.PLATFORM_OTHER];

export const INVOICE_ITEM_LABELS_FA: Record<InvoiceItemType, string> = {
  WATER: 'آب‌بها',
  SEWAGE: 'فاضلاب‌بها',
  RENOVATION_SHARE: 'سهم هزینه‌های نوسازی، بازسازی و تعمیرات',
  SHARE_DEBT: 'بدهی سهام',
  CHARGE_OTHER: 'سایر',
  ENTRANCE_FEE: 'ورودی',
  MONTHLY_MEMBERSHIP: 'حق عضویت ماهانه',
  PLATFORM_OTHER: 'سایر',
  CARRIED_PENALTY: 'جریمه تأخیر قبلی',
};

export const MAX_INVOICE_AMOUNT = 9_999_999_999_999.99;
export const MAX_INVOICE_ITEMS = 20;

export type InvoiceItemInput = { type: InvoiceItemType | string; title?: string | null; amount: number | string };
export type NormalizedInvoiceItem = { type: InvoiceItemType; title: string | null; amount: number; sortOrder: number };

export function money(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Super admins issue platform bills (entrance / membership); everyone else issues park charge bills. */
export function categoryForRole(role: Role): InvoiceCategory {
  return role === Role.SUPER_ADMIN ? InvoiceCategory.PLATFORM : InvoiceCategory.CHARGE;
}

export function allowedItemTypes(category: InvoiceCategory): readonly InvoiceItemType[] {
  return category === InvoiceCategory.PLATFORM ? PLATFORM_ITEM_TYPES : CHARGE_ITEM_TYPES;
}

export function itemLabel(item: { type: InvoiceItemType; title?: string | null }): string {
  const title = item.title?.trim();
  if (title && (OTHER_ITEM_TYPES.includes(item.type) || item.type === InvoiceItemType.CARRIED_PENALTY)) return title;
  return INVOICE_ITEM_LABELS_FA[item.type] || String(item.type);
}

export function normalizeInvoiceItems(items: InvoiceItemInput[], category: InvoiceCategory): NormalizedInvoiceItem[] {
  if (!Array.isArray(items) || !items.length) throw new BadRequestException('حداقل یک ردیف برای قبض لازم است');
  if (items.length > MAX_INVOICE_ITEMS) throw new BadRequestException(`حداکثر ${MAX_INVOICE_ITEMS} ردیف مجاز است`);
  const allowed = allowedItemTypes(category);
  return items.map((item, index) => {
    const type = String(item?.type || '') as InvoiceItemType;
    if (!allowed.includes(type)) {
      throw new BadRequestException(`نوع ردیف ${index + 1} برای این نوع قبض مجاز نیست`);
    }
    const amount = money(Number(item.amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_INVOICE_AMOUNT) {
      throw new BadRequestException(`مبلغ ردیف ${index + 1} نامعتبر است`);
    }
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 200) : '';
    if (OTHER_ITEM_TYPES.includes(type) && !title) {
      throw new BadRequestException(`برای ردیف «سایر» (ردیف ${index + 1}) عنوان لازم است`);
    }
    return { type, title: title || null, amount, sortOrder: index };
  });
}

export function sumItems(items: Array<{ amount: number }>): number {
  return money(items.reduce((total, item) => total + Number(item.amount || 0), 0));
}

export function formatRial(value: number): string {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

export function itemsSummaryFa(items: Array<{ type: InvoiceItemType; title?: string | null; amount: number | unknown }>): string {
  return items.map((item) => `${itemLabel(item)}: ${formatRial(Number(item.amount))}`).join('، ');
}

export function defaultInvoiceDescription(category: InvoiceCategory, items: Array<{ type: InvoiceItemType; title?: string | null }>): string {
  const prefix = category === InvoiceCategory.PLATFORM ? 'صورتحساب سامانه' : 'قبض شارژ';
  const labels = Array.from(new Set(items.map((item) => itemLabel(item))));
  return `${prefix}: ${labels.join('، ')}`.slice(0, 2000);
}

/** Jalali yyyy/mm/dd in Asia/Tehran (dates are stored at UTC midnight or noon). */
export function formatJalaliDate(date: Date): string {
  const tehran = new Date(date.getTime() + 3.5 * 3_600_000);
  const { jy, jm, jd } = toJalaali(tehran.getUTCFullYear(), tehran.getUTCMonth() + 1, tehran.getUTCDate());
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

/** UTC calendar days from `anchor` to `asOf`; the anchor day itself is not late. */
export function calendarDaysLate(anchor: Date, asOf: Date = new Date()): number {
  const due = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  const now = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const diff = Math.floor((now - due) / 86_400_000);
  return diff > 0 ? diff : 0;
}

/** Equal split in whole Rials; the remainder (including decimals) lands on the last installment. */
export function splitEvenly(total: number, count: number): number[] {
  const base = Math.floor(money(total) / count);
  const amounts = Array.from({ length: count }, () => base);
  amounts[count - 1] = money(total - base * (count - 1));
  return amounts;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
