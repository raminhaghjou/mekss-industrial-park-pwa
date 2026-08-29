import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('./base.api', () => ({
  default: { get: mocks.get },
}));

const { reportApi } = await import('./report.api');

describe('report API contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requests the real scoped report endpoint with the type/from/to filters', () => {
    reportApi.getReport('financial', '2027-01-01', '2027-01-31');

    expect(mocks.get).toHaveBeenCalledWith('/reports', { params: { type: 'financial', from: '2027-01-01', to: '2027-01-31' } });
  });
});
