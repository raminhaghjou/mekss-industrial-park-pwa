import { describe, expect, it } from 'vitest';
import { advertisementImageIds, publicAdvertisementImageUrl } from './advertisementImages';
import { isSessionlessAuthRequest } from '../services/api/base.api';

describe('advertisement images', () => {
  it('serves media ids through the public approved-ad endpoint', () => {
    expect(publicAdvertisementImageUrl('abc123')).toBe('/api/v1/files/public/advertisement-images/abc123');
  });

  it('keeps legacy absolute URLs untouched', () => {
    expect(publicAdvertisementImageUrl('https://cdn.test/ad.webp')).toBe('https://cdn.test/ad.webp');
    expect(publicAdvertisementImageUrl(null)).toBeNull();
  });

  it('normalizes stored ids and freshly uploaded file DTOs to ids', () => {
    expect(advertisementImageIds(['id-1', { id: 'id-2' }, null, { originalName: 'x' }])).toEqual(['id-1', 'id-2']);
  });
});

describe('isSessionlessAuthRequest', () => {
  it('treats credential endpoints as form errors, not expired sessions', () => {
    for (const url of ['/auth/login', '/auth/register', '/auth/refresh', '/auth/otp/verify', '/auth/password/reset', '/auth/check-phone']) {
      expect(isSessionlessAuthRequest(url)).toBe(true);
    }
  });

  it('still refreshes for authenticated endpoints', () => {
    for (const url of ['/auth/me', '/auth/change-password', '/factories', undefined]) {
      expect(isSessionlessAuthRequest(url)).toBe(false);
    }
  });
});
