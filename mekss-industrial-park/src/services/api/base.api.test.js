import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const requestUse = vi.fn();
  const responseUse = vi.fn();
  const client = /** @type {any} */ (vi.fn(async (config) => ({ status: 200, config })));
  client.interceptors = {
    request: { use: requestUse },
    response: { use: responseUse },
  };
  return { client, requestUse, responseUse, post: vi.fn() };
});

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mocks.client),
    post: mocks.post,
    Cancel: class Cancel extends Error {},
  },
}));

await import('./base.api');

const deferred = () => {
  let resolve = /** @type {(value: any) => void} */ (() => {});
  let reject = /** @type {(reason?: any) => void} */ (() => {});
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('API refresh interceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.client.mockClear();
    mocks.post.mockReset();
  });

  it('single-flights concurrent 401 responses and retries both with one rotated token pair', async () => {
    localStorage.setItem('accessToken', 'stale-access');
    localStorage.setItem('refreshToken', 'initial-refresh');
    const rotation = deferred();
    mocks.post.mockReturnValue(rotation.promise);
    const rejected = mocks.responseUse.mock.calls[0][1];
    const firstConfig = { url: '/users', method: 'get', headers: {} };
    const secondConfig = { url: '/industrial-parks', method: 'get', headers: {} };

    const first = rejected({ response: { status: 401 }, config: firstConfig });
    const second = rejected({ response: { status: 401 }, config: secondConfig });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/auth/refresh', { refreshToken: 'initial-refresh' });

    rotation.resolve({ data: { accessToken: 'rotated-access', refreshToken: 'rotated-refresh' } });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);

    expect(localStorage.getItem('accessToken')).toBe('rotated-access');
    expect(localStorage.getItem('refreshToken')).toBe('rotated-refresh');
    expect(mocks.client).toHaveBeenCalledTimes(2);
    expect(firstConfig.headers.Authorization).toBe('Bearer rotated-access');
    expect(secondConfig.headers.Authorization).toBe('Bearer rotated-access');
  });
});
