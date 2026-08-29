import { describe, expect, it } from 'vitest';
import {
  advertisementStatusLabels,
  factoryStatusLabels,
  gatePassStatusLabels,
  invoiceStatusLabels,
  labelFor,
  parkStatusLabels,
  requestPriorityLabels,
  requestStatusLabels,
  requestTypeLabels,
  roleLabels,
} from './persianLabels';

describe('canonical Persian enum labels', () => {
  it('covers every canonical role from the backend Role enum', () => {
    expect(Object.keys(roleLabels).sort()).toEqual([
      'EMPLOYEE', 'FACTORY_OWNER', 'GOVERNMENT_OFFICIAL', 'PARK_MANAGER', 'SECURITY_GUARD', 'SUPER_ADMIN',
    ].sort());
  });

  it('covers every status/priority/type enum used across admin pages', () => {
    expect(Object.keys(requestStatusLabels).sort()).toEqual(['APPROVED', 'CANCELLED', 'PENDING', 'REJECTED'].sort());
    expect(Object.keys(requestPriorityLabels).sort()).toEqual(['HIGH', 'LOW', 'MEDIUM', 'URGENT'].sort());
    expect(Object.keys(invoiceStatusLabels).sort()).toEqual(['CANCELLED', 'OVERDUE', 'PAID', 'PENDING'].sort());
    expect(Object.keys(gatePassStatusLabels).sort()).toEqual(['APPROVED', 'COMPLETED', 'EXPIRED', 'PENDING', 'REJECTED'].sort());
    expect(Object.keys(factoryStatusLabels).sort()).toEqual(['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'].sort());
    expect(Object.keys(advertisementStatusLabels).sort()).toEqual(['APPROVED', 'EXPIRED', 'PENDING', 'REJECTED'].sort());
    expect(Object.keys(parkStatusLabels).sort()).toEqual(['ACTIVE', 'INACTIVE'].sort());
  });

  it('includes every request type validated by CreateRequestDto', () => {
    expect(Object.keys(requestTypeLabels).sort()).toEqual([
      'APPOINTMENT', 'CONSTRUCTION_PERMIT', 'DAILY_LEAVE', 'FINAL_INSPECTION', 'HOURLY_LEAVE',
      'LOAN', 'MISSION', 'OTHER', 'SERVICE_ORDER', 'SETTLEMENT', 'TRANSFER',
    ].sort());
  });
});

describe('labelFor', () => {
  it('returns the mapped Persian label for a known enum value', () => {
    expect(labelFor(roleLabels, 'SUPER_ADMIN')).toBe('مدیر کل سامانه');
  });

  it('falls back to the raw value for an unmapped enum instead of hiding it', () => {
    expect(labelFor(roleLabels, 'UNKNOWN_ROLE')).toBe('UNKNOWN_ROLE');
  });

  it('returns an empty string for a null/undefined value', () => {
    expect(labelFor(roleLabels, null)).toBe('');
    expect(labelFor(roleLabels, undefined)).toBe('');
  });
});
