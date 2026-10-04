import { describe, expect, it } from 'vitest';
import { daysUntilDue, invoiceDueInfo } from './invoiceDue';
import { bannerImageWarning } from './bannerImage';
import { backTarget, safeInternalPath } from './navigation';
import { previewEvenSplit, summarizeImportPreview } from '../components/invoices/invoiceHelpers';

describe('summarizeImportPreview', () => {
  it('allows commit only when every row is valid and the file was not imported before', () => {
    const preview = { rows: [{ row: 2, errors: [] }, { row: 3 }] };
    expect(summarizeImportPreview(preview)).toMatchObject({ validCount: 2, canCommit: true });
    expect(summarizeImportPreview({ ...preview, alreadyImported: true }).canCommit).toBe(false);
  });

  it('separates rows with errors and blocks commit', () => {
    const summary = summarizeImportPreview({ rows: [{ row: 2, errors: [] }, { row: 3, errors: ['شناسه ملی یافت نشد'] }] });
    expect(summary.invalid).toHaveLength(1);
    expect(summary.validCount).toBe(1);
    expect(summary.canCommit).toBe(false);
  });

  it('handles empty or malformed previews', () => {
    expect(summarizeImportPreview(null)).toMatchObject({ rows: [], validCount: 0, canCommit: false });
    expect(summarizeImportPreview({ rows: 'x' }).rows).toEqual([]);
  });
});

describe('previewEvenSplit', () => {
  it('puts the remainder on the last installment', () => {
    expect(previewEvenSplit(1000, 3)).toEqual([333, 333, 334]);
    expect(previewEvenSplit(1000, 3).reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('rejects fewer than two installments or a non-positive total', () => {
    expect(previewEvenSplit(1000, 1)).toEqual([]);
    expect(previewEvenSplit(0, 3)).toEqual([]);
  });
});

describe('invoice due date', () => {
  const now = new Date('2026-10-04T10:00:00.000Z');

  it('counts whole calendar days to the due date', () => {
    expect(daysUntilDue('2026-10-09T00:00:00.000Z', now)).toBe(5);
    expect(daysUntilDue('2026-10-04T23:00:00.000Z', now)).toBe(0);
    expect(daysUntilDue('2026-10-01T00:00:00.000Z', now)).toBe(-3);
    expect(daysUntilDue(null, now)).toBeNull();
  });

  it('describes remaining, last-day and overdue states for open invoices', () => {
    expect(invoiceDueInfo({ status: 'PENDING', dueDate: '2026-10-14T00:00:00.000Z' }, now)).toMatchObject({ days: 10, tone: 'success' });
    expect(invoiceDueInfo({ status: 'PENDING', dueDate: '2026-10-06T00:00:00.000Z' }, now).tone).toBe('warning');
    expect(invoiceDueInfo({ status: 'PENDING', dueDate: '2026-10-04T00:00:00.000Z' }, now).text).toContain('امروز');
    const overdue = invoiceDueInfo({ status: 'OVERDUE', dueDate: '2026-10-01T00:00:00.000Z' }, now);
    expect(overdue.tone).toBe('danger');
    expect(overdue.text).toContain('مشمول جریمه');
  });

  it('keeps the penalty warning after a due-date extension', () => {
    const info = invoiceDueInfo({ status: 'PENDING', dueDate: '2026-10-20T00:00:00.000Z', lateDays: 4 }, now);
    expect(info.tone).toBe('danger');
    expect(info.text).toContain('جریمه');
  });

  it('prefers the server-computed daysLeft and ignores paid invoices', () => {
    expect(invoiceDueInfo({ status: 'PENDING', dueDate: '2026-10-20T00:00:00.000Z', daysLeft: 2 }, now).days).toBe(2);
    expect(invoiceDueInfo({ status: 'PAID', dueDate: '2026-10-01T00:00:00.000Z' }, now)).toMatchObject({ text: '', tone: 'default' });
  });
});

describe('bannerImageWarning', () => {
  it('accepts the recommended sizes', () => {
    expect(bannerImageWarning('desktop', 1920, 480)).toBe('');
    expect(bannerImageWarning('mobile', 1080, 540)).toBe('');
  });

  it('warns on a wrong aspect ratio or a too-small image', () => {
    expect(bannerImageWarning('desktop', 1080, 540)).toContain('نسبت تصویر');
    expect(bannerImageWarning('mobile', 600, 300)).toContain('وضوح تصویر');
    expect(bannerImageWarning('unknown', 10, 10)).toBe('');
  });
});

describe('navigation helpers', () => {
  it('accepts only same-app paths', () => {
    expect(safeInternalPath('/invoices')).toBe('/invoices');
    expect(safeInternalPath('//evil.example')).toBe('/dashboard');
    expect(safeInternalPath('https://evil.example')).toBe('/dashboard');
    expect(safeInternalPath('/\\evil')).toBe('/dashboard');
    expect(safeInternalPath(undefined)).toBe('/dashboard');
    expect(safeInternalPath('/select-factory', '/dashboard', ['/select-factory'])).toBe('/dashboard');
  });

  it('goes back in history only when the tab has an in-app entry', () => {
    expect(backTarget(3)).toBe(-1);
    expect(backTarget(0)).toBe('/dashboard');
    expect(backTarget(undefined, '/welcome')).toBe('/welcome');
  });
});
