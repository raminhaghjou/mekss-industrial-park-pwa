import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('./base.api', () => ({
  default: { get: mocks.get, post: mocks.post, put: mocks.put },
}));

const { factoryApi } = await import('./factory.api');

describe('factory API contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves the legacy selector route and uses dedicated managed read routes', () => {
    const legacyParams = { parkId: 'park-legacy' };
    const managedParams = { page: 2, pageSize: 12, search: 'فولاد', status: 'ACTIVE', parkId: 'park-1' };

    factoryApi.getFactories(legacyParams);
    factoryApi.getManagedFactories(managedParams);
    factoryApi.getManagedFactory('factory-1');
    factoryApi.getManagementScope();

    expect(mocks.get.mock.calls).toEqual([
      ['/factories', { params: legacyParams }],
      ['/factories/managed', { params: managedParams }],
      ['/factories/managed/factory-1'],
      ['/factories/management-scope'],
    ]);
  });

  it('sends create/update payloads unchanged and uses explicit decision routes and bodies', () => {
    const createPayload = { name: 'واحد نمونه', parkId: 'park-1', managerId: 'owner-1' };
    const updatePayload = { name: 'نام ویرایش‌شده', employees: 24 };

    factoryApi.createFactory(createPayload);
    factoryApi.updateFactory('factory-1', updatePayload);
    factoryApi.approveFactory('factory-1');
    factoryApi.rejectFactory('factory-2', 'مدارک مجوز ناقص است');

    expect(mocks.post.mock.calls).toEqual([
      ['/factories', createPayload],
      ['/factories/factory-1/approve'],
      ['/factories/factory-2/reject', { reason: 'مدارک مجوز ناقص است' }],
    ]);
    expect(mocks.put).toHaveBeenCalledWith('/factories/factory-1', updatePayload);
  });
});
