import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('./base.api', () => ({
  default: { get: mocks.get, post: mocks.post },
}));

const { gatePassApi } = await import('./gatePass.api');

describe('gate pass API contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the list and a single detail from the real management routes', () => {
    const params = { status: 'PENDING' };
    gatePassApi.getGatePasses(params);
    gatePassApi.getGatePass('pass-1');

    expect(mocks.get).toHaveBeenCalledWith('/gate-passes', { params });
    expect(mocks.get).toHaveBeenCalledWith('/gate-passes/pass-1');
  });

  it('creates a gate pass and sends every decision to its explicit action route', () => {
    const createPayload = { factoryId: 'factory-1', driverName: 'راننده' };
    gatePassApi.createGatePass(createPayload);
    gatePassApi.approveGatePass('pass-1');
    gatePassApi.rejectGatePass('pass-2', { reason: 'دلیل رد' });
    gatePassApi.verifyGatePass('pass-3');
    gatePassApi.denyGatePassExit('pass-4', { reason: 'مغایرت پلاک' });

    expect(mocks.post.mock.calls).toEqual([
      ['/gate-passes', createPayload],
      ['/gate-passes/pass-1/approve'],
      ['/gate-passes/pass-2/reject', { reason: 'دلیل رد' }],
      ['/gate-passes/pass-3/verify'],
      ['/gate-passes/pass-4/deny', { reason: 'مغایرت پلاک' }],
    ]);
  });
});
