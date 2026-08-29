import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('./base.api', () => ({
  default: { get: mocks.get, post: mocks.post },
}));

const { requestApi } = await import('./request.api');

describe('request API contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists and creates requests against the real management routes', () => {
    const params = { status: 'PENDING' };
    const createPayload = { factoryId: 'factory-1', type: 'OTHER', title: 'عنوان', description: 'شرح' };

    requestApi.getRequests(params);
    requestApi.createRequest(createPayload);

    expect(mocks.get).toHaveBeenCalledWith('/requests', { params });
    expect(mocks.post).toHaveBeenCalledWith('/requests', createPayload);
  });

  it('sends approve/reject decisions to their explicit action routes', () => {
    requestApi.approveRequest('request-1');
    requestApi.rejectRequest('request-2', { reason: 'دلیل رد' });

    expect(mocks.post.mock.calls).toEqual([
      ['/requests/request-1/approve'],
      ['/requests/request-2/reject', { reason: 'دلیل رد' }],
    ]);
  });
});
