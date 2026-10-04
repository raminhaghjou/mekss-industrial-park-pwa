import { formatJalaliDate, toFaDigits } from './jalali';

const DAY_MS = 86_400_000;

/** Whole UTC calendar days from today to the due date (negative once overdue), matching the backend rule. */
export const daysUntilDue = (dueDate, now = new Date()) => {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((dueDay - today) / DAY_MS);
};

const OPEN_STATUSES = new Set(['PENDING', 'OVERDUE']);

/**
 * Due-date text for an invoice: Jalali date plus "X روز مانده" / "X روز گذشته (مشمول جریمه)".
 * `tone` is one of success | warning | danger | default.
 */
export const invoiceDueInfo = (invoice, now = new Date()) => {
  const dateFa = formatJalaliDate(invoice?.dueDate) || '—';
  const days = typeof invoice?.daysLeft === 'number' ? invoice.daysLeft : daysUntilDue(invoice?.dueDate, now);
  if (!OPEN_STATUSES.has(invoice?.status) || days === null) {
    return { dateFa, days, text: '', tone: 'default' };
  }
  const penaltyRunning = Number(invoice?.lateDays || 0) > 0;
  if (days > 0) {
    return {
      dateFa,
      days,
      text: `${toFaDigits(days)} روز مانده${penaltyRunning ? ' · جریمهٔ تأخیر قبلی همچنان محاسبه می‌شود' : ''}`,
      tone: penaltyRunning ? 'danger' : days <= 3 ? 'warning' : 'success',
    };
  }
  if (days === 0) {
    return { dateFa, days, text: `امروز آخرین مهلت پرداخت است${penaltyRunning ? ' · جریمه در جریان' : ''}`, tone: penaltyRunning ? 'danger' : 'warning' };
  }
  return { dateFa, days, text: `${toFaDigits(-days)} روز گذشته (مشمول جریمه)`, tone: 'danger' };
};
