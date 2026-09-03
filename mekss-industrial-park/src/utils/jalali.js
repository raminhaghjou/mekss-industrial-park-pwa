import {
  isValidJalaaliDate,
  jalaaliMonthLength,
  jalaaliToDateObject,
  toGregorian,
  toJalaali,
} from 'jalaali-js';

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const JALALI_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export const pad2 = (value) => String(value).padStart(2, '0');

export const toFaDigits = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

export const toIsoDate = (gy, gm, gd) => `${gy}-${pad2(gm)}-${pad2(gd)}`;

export const parseIsoDate = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const gy = Number(match[1]);
  const gm = Number(match[2]);
  const gd = Number(match[3]);
  if (!gy || !gm || !gd) return null;
  return { gy, gm, gd };
};

export const jalaliFromIsoDate = (value) => {
  const parsed = parseIsoDate(value);
  if (!parsed) return null;
  return toJalaali(parsed.gy, parsed.gm, parsed.gd);
};

export const isoDateFromJalali = (jy, jm, jd) => {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return toIsoDate(gy, gm, gd);
};

export const formatJalaliDate = (value) => {
  const jalali = jalaliFromIsoDate(value);
  if (!jalali) return '';
  return toFaDigits(`${jalali.jy}/${pad2(jalali.jm)}/${pad2(jalali.jd)}`);
};

export const isoDateTimeFromJalali = (jy, jm, jd, hours = 0, minutes = 0) => (
  jalaaliToDateObject(jy, jm, jd, hours, minutes, 0, 0).toISOString()
);

export const partsFromIsoValue = (value) => {
  if (!value) return null;
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime()) && String(value).includes('T')) {
    const jalali = toJalaali(asDate);
    return { ...jalali, hours: asDate.getHours(), minutes: asDate.getMinutes() };
  }
  const jalali = jalaliFromIsoDate(value);
  if (!jalali) return null;
  return { ...jalali, hours: 8, minutes: 0 };
};

export const todayIsoDate = () => {
  const now = new Date();
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

export const calendarCells = (jy, jm) => {
  const days = jalaaliMonthLength(jy, jm);
  const weekdayOffset = (jalaaliToDateObject(jy, jm, 1).getDay() + 1) % 7;
  /** @type {Array<number | null>} */
  const cells = [];
  for (let index = 0; index < weekdayOffset; index += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) cells.push(day);
  return cells;
};

export const shiftJalaliMonth = (jy, jm, delta) => {
  const absolute = jy * 12 + (jm - 1) + delta;
  const nextYear = Math.floor(absolute / 12);
  const nextMonth = (absolute % 12 + 12) % 12;
  return { jy: nextYear, jm: nextMonth + 1 };
};

export const isPersistableIsoDate = (value) => {
  const parsed = parseIsoDate(value);
  if (!parsed) return false;
  try {
    const jalali = toJalaali(parsed.gy, parsed.gm, parsed.gd);
    return isValidJalaaliDate(jalali.jy, jalali.jm, jalali.jd);
  } catch {
    return false;
  }
};

export const isPersistableIsoDateTime = (value) => {
  if (!value || !String(value).includes('T')) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === new Date(date.toISOString()).toISOString();
};
