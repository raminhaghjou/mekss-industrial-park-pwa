import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('./base.api', () => ({
  default: { get: mocks.get },
}));

const { smsApi } = await import('./sms.api');

describe('sms API contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the non-secret provider health endpoint', () => {
    smsApi.getHealth();

    expect(mocks.get).toHaveBeenCalledWith('/sms/health');
  });
});
