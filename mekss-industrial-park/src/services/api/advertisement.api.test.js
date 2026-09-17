import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('./base.api', () => ({
  default: { get: mocks.get, post: mocks.post, put: mocks.put, delete: mocks.delete },
}));

const { advertisementApi } = await import('./advertisement.api');

describe('advertisement API contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves public and legacy reads while using paginated managed list/detail routes', () => {
    advertisementApi.getPublicAdvertisements();
    advertisementApi.getMyAdvertisements();
    advertisementApi.getMyAdvertisement('ad_1');
    advertisementApi.getCreationScope();
    advertisementApi.getManagedPending();
    advertisementApi.getManagedHistory();
    advertisementApi.getManagedAdvertisements({ view: 'HISTORY', page: 2, pageSize: 12 });
    advertisementApi.getManagedAdvertisement('ad_1');

    expect(mocks.get.mock.calls).toEqual([
      ['/advertisements'],
      ['/advertisements/mine'],
      ['/advertisements/mine/ad_1'],
      ['/advertisements/creation-scope'],
      ['/advertisements/managed/pending'],
      ['/advertisements/managed/history'],
      ['/advertisements/managed', { params: { view: 'HISTORY', page: 2, pageSize: 12 } }],
      ['/advertisements/managed/ad_1'],
    ]);
  });

  it('sends canonical creation and approve/reject bodies to the shared transition route', () => {
    const payload = { title: 'Advertisement', parkId: 'park_1' };
    advertisementApi.createAdvertisement(payload);
    advertisementApi.updateMyAdvertisement('ad_1', payload);
    advertisementApi.deleteMyAdvertisement('ad_1');
    advertisementApi.approveAdvertisement('ad_1');
    advertisementApi.rejectAdvertisement('ad_2', 'دلیل معتبر');

    expect(mocks.post.mock.calls).toEqual([
      ['/advertisements', payload],
      ['/advertisements/ad_1/approve', { approved: true }],
      ['/advertisements/ad_2/approve', { approved: false, rejectionReason: 'دلیل معتبر' }],
    ]);
    expect(mocks.put.mock.calls).toEqual([['/advertisements/mine/ad_1', payload]]);
    expect(mocks.delete.mock.calls).toEqual([['/advertisements/mine/ad_1']]);
  });
});
