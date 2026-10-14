import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
}));

vi.mock('./base.api', () => ({
  default: { get: mocks.get, put: mocks.put, post: mocks.post },
}));

const { smsApi } = await import('./sms.api');

describe('sms API contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the non-secret provider health endpoint', () => {
    smsApi.getHealth();

    expect(mocks.get).toHaveBeenCalledWith('/sms/health');
  });

  it('reads and writes the gateway settings, sends tests and checks credit', () => {
    smsApi.getSettings();
    smsApi.updateSettings({ provider: 'melipayamak' });
    smsApi.sendTest('09120000000', 'otp');
    smsApi.getCredit();

    expect(mocks.get).toHaveBeenCalledWith('/sms/settings');
    expect(mocks.put).toHaveBeenCalledWith('/sms/settings', { provider: 'melipayamak' });
    expect(mocks.post).toHaveBeenCalledWith('/sms/test', { phoneNumber: '09120000000', kind: 'otp' });
    expect(mocks.get).toHaveBeenCalledWith('/sms/credit');
  });
});
