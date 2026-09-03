import { describe, expect, it } from 'vitest';
import {
  formatJalaliDate,
  isPersistableIsoDate,
  isPersistableIsoDateTime,
  isoDateFromJalali,
  isoDateTimeFromJalali,
  jalaliFromIsoDate,
} from './jalali';

describe('jalali calendar conversions for API persistence', () => {
  it('maps Nowruz 1403 to the Gregorian ISO date the backend already accepts', () => {
    expect(isoDateFromJalali(1403, 1, 1)).toBe('2024-03-20');
    expect(jalaliFromIsoDate('2024-03-20')).toEqual({ jy: 1403, jm: 1, jd: 1 });
    expect(formatJalaliDate('2024-03-20')).toContain('۱۴۰۳');
  });

  it('emits ISO date and datetime payloads that Date and IsDateString consumers can store', () => {
    const dueDate = isoDateFromJalali(1405, 1, 1);
    const exitDate = isoDateTimeFromJalali(1405, 6, 12, 14, 30);
    const expiresAt = new Date(dueDate).toISOString();

    expect(isPersistableIsoDate(dueDate)).toBe(true);
    expect(isPersistableIsoDateTime(exitDate)).toBe(true);
    expect(Number.isNaN(new Date(dueDate).getTime())).toBe(false);
    expect(Number.isNaN(new Date(exitDate).getTime())).toBe(false);
    expect(exitDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
