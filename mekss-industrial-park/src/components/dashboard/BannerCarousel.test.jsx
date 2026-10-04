import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActive: vi.fn(),
  recordClick: vi.fn(),
  getContentBlob: vi.fn(),
}));

vi.mock('../../services/api/banner.api', async (importOriginal) => {
  const actual = /** @type {Record<string, unknown>} */ (await importOriginal());
  return {
    ...actual,
    bannerApi: { getActive: mocks.getActive, recordClick: mocks.recordClick },
  };
});
vi.mock('../../services/api/files.api', () => ({
  filesApi: { getContentBlob: mocks.getContentBlob },
}));

const { BannerCarousel } = await import('./BannerCarousel');

const banners = [
  { id: 'b1', title: 'بنر اول', desktopImageId: 'd1', mobileImageId: 'm1', linkUrl: '/invoices' },
  { id: 'b2', title: 'بنر دوم', desktopImageId: 'd2', mobileImageId: 'm2', linkUrl: 'https://example.com/x' },
  { id: 'b3', title: 'بنر سوم', desktopImageId: 'd3', mobileImageId: 'm3', linkUrl: 'javascript:alert(1)' },
];

const flush = async (ms = 0) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};
const waitFor = async (assertion) => {
  let failure;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      failure = error;
      await flush(10);
    }
  }
  throw failure;
};

describe('BannerCarousel', () => {
  let container;
  let root;
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.URL.createObjectURL = vi.fn((blob) => `blob:${blob.name || 'img'}`);
    globalThis.URL.revokeObjectURL = vi.fn();
    mocks.recordClick.mockResolvedValue({});
    mocks.getContentBlob.mockImplementation(async (id) => Object.assign(new Blob(['x'], { type: 'image/png' }), { name: id }));
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  const render = async (props = {}) => {
    await act(async () => root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<BannerCarousel {...props} />} />
            <Route path="/invoices" element={<div data-testid="invoices-page">قبض‌ها</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ));
  };

  const activeSlide = () => container.querySelector('[aria-roledescription="slide"][data-active="true"]');

  it('renders nothing when there are no active banners', async () => {
    mocks.getActive.mockResolvedValue({ data: [] });
    await render();
    await flush(20);
    expect(container.querySelector('[data-testid="banner-carousel"]')).toBeNull();
  });

  it('loads only the current and next desktop images, not every variant', async () => {
    mocks.getActive.mockResolvedValue({ data: banners });
    await render({ intervalMs: 60_000 });
    await waitFor(() => expect(container.querySelector('[data-testid="banner-carousel"]')).not.toBeNull());
    await waitFor(() => expect(container.querySelector('img[alt="بنر اول"]')?.getAttribute('src')).toBe('blob:d1'));

    const requested = mocks.getContentBlob.mock.calls.map(([id]) => id).sort();
    expect(requested).toEqual(['d1', 'd2']);
  });

  it('rotates automatically and supports next / previous / dot navigation', async () => {
    mocks.getActive.mockResolvedValue({ data: banners });
    await render({ intervalMs: 80 });
    await waitFor(() => expect(activeSlide()?.getAttribute('aria-label')).toContain('بنر اول'));
    await waitFor(() => expect(activeSlide()?.getAttribute('aria-label')).toContain('بنر دوم'));

    await render({ intervalMs: 60_000 });
    const clickLabel = async (label) => {
      const button = container.querySelector(`button[aria-label="${label}"]`);
      await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };
    await clickLabel('نمایش بنر 3');
    expect(activeSlide()?.getAttribute('aria-label')).toContain('بنر سوم');
    await clickLabel('بنر بعدی');
    expect(activeSlide()?.getAttribute('aria-label')).toContain('بنر اول');
    await clickLabel('بنر قبلی');
    expect(activeSlide()?.getAttribute('aria-label')).toContain('بنر سوم');
  });

  it('records clicks, routes internal links in-app and never renders unsafe links', async () => {
    mocks.getActive.mockResolvedValue({ data: banners });
    await render({ intervalMs: 60_000 });
    await waitFor(() => expect(container.querySelector('a[href="/invoices"]')).not.toBeNull());

    const external = container.querySelector('a[href="https://example.com/x"]');
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();

    const internal = container.querySelector('a[href="/invoices"]');
    await act(async () => internal.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    expect(mocks.recordClick).toHaveBeenCalledWith('b1');
    await waitFor(() => expect(container.querySelector('[data-testid="invoices-page"]')).not.toBeNull());
  });
});
