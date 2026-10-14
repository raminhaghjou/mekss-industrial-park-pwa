import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getManaged: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getParks: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../services/api/banner.api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    bannerApi: { getManaged: mocks.getManaged, create: mocks.create, update: mocks.update, remove: mocks.remove },
  };
});
vi.mock('../../services/api/park.api', () => ({ parkApi: { getParks: mocks.getParks } }));
vi.mock('../../services/api/files.api', () => ({ filesApi: { upload: vi.fn() } }));
vi.mock('../../components/common/AuthenticatedImage', () => ({ AuthenticatedImage: () => null }));
vi.mock('../../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));

import ManageBannersPage from './ManageBannersPage';

const banner = {
  id: 'banner-1',
  title: 'بنر آزمایشی',
  desktopImageId: 'desk-1',
  mobileImageId: 'mob-1',
  linkUrl: null,
  openInNewTab: true,
  isActive: true,
  sortOrder: 0,
  startsAt: null,
  endsAt: null,
  parkId: null,
};

const flush = async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
};
const waitFor = async (assertion) => {
  let failure;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      failure = error;
      await flush();
    }
  }
  throw failure;
};
const button = (label) => [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === label);
const click = async (element) => {
  if (!element) throw new Error('button not found');
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await flush();
};
const submitForm = async () => {
  const form = document.querySelector('form');
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await flush();
};
const formError = () => document.querySelector('[data-testid="banner-form-error"]')?.textContent || '';

describe('ManageBannersPage', () => {
  let container;
  let root;
  let queryClient;

  beforeEach(async () => {
    vi.resetAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.getManaged.mockResolvedValue({ data: [banner] });
    mocks.getParks.mockResolvedValue({ data: [] });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <QueryClientProvider client={queryClient}>
        <ManageBannersPage />
      </QueryClientProvider>,
    ));
    await waitFor(() => expect(document.body.textContent).toContain('بنر آزمایشی'));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('explains the display priority field', async () => {
    await click(button('بنر جدید'));
    expect(document.body.textContent).toContain('اولویت نمایش');
    expect(document.getElementById('banner-sort-order-help')?.textContent).toContain('عدد کوچک‌تر زودتر نمایش داده می‌شود');
  });

  it('shows which image is missing inside the form instead of failing silently', async () => {
    await click(button('بنر جدید'));
    const title = /** @type {HTMLInputElement} */ (document.querySelector('form input'));
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(title, 'بنر جدید');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await submitForm();
    expect(formError()).toContain('تصویر دسکتاپ و تصویر موبایل بارگذاری نشده است');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and shows the server error inside it', async () => {
    mocks.update.mockRejectedValueOnce({ response: { status: 400, data: { message: 'تصویر بنر معتبر نیست؛ تصویر را دوباره بارگذاری کنید' } } });
    await click(button('ویرایش'));
    await submitForm();
    await waitFor(() => expect(formError()).toContain('تصویر بنر معتبر نیست'));
    expect(mocks.update).toHaveBeenCalledWith('banner-1', expect.objectContaining({ title: 'بنر آزمایشی', sortOrder: 0 }));
    expect(button('ذخیره بنر')).toBeDefined();
  });
});
