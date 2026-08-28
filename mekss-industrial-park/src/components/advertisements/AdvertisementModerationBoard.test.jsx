import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getManagedAdvertisements: vi.fn(),
  getManagedAdvertisement: vi.fn(),
  approveAdvertisement: vi.fn(),
  rejectAdvertisement: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../services/api/advertisement.api', () => ({
  advertisementApi: {
    getManagedAdvertisements: mocks.getManagedAdvertisements,
    getManagedAdvertisement: mocks.getManagedAdvertisement,
    approveAdvertisement: mocks.approveAdvertisement,
    rejectAdvertisement: mocks.rejectAdvertisement,
  },
}));

vi.mock('../../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));

import { AdvertisementModerationBoard } from './AdvertisementModerationBoard';

const pendingAd = {
  id: 'ad-pending', title: 'آگهی تست محدوده', status: 'PENDING', province: 'تهران', city: 'تهران',
  content: 'متن آگهی تست', createdAt: '2026-08-28T10:00:00.000Z',
  category: { key: 'OTHER', label: 'سایر' }, createdBy: { name: 'مالک تست' }, park: { id: 'park-a', name: 'شهرک الف' },
};
const expiredAd = { ...pendingAd, id: 'ad-expired', title: 'آگهی منقضی', status: 'EXPIRED' };
const page = (items, view) => ({ data: { items, total: items.length, page: 1, pageSize: 12, availableParks: [{ id: 'park-a', name: 'شهرک الف' }], view } });

const deferred = () => {
  let reject = /** @type {(reason?: any) => void} */ (() => {});
  const promise = new Promise((_resolve, rejectPromise) => { reject = rejectPromise; });
  return { promise, reject };
};

const flush = async (milliseconds = 0) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
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

const button = (label) => [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === label);
const click = async (element) => {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await flush();
};
const typeReason = async (value) => {
  const field = document.querySelector('textarea');
  if (!field) throw new Error('reason field not found');
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return field;
};

describe('AdvertisementModerationBoard', () => {
  let container;
  let root;
  let queryClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.getManagedAdvertisements.mockImplementation((params) => Promise.resolve(
      params.view === 'HISTORY' ? page([expiredAd], 'HISTORY') : page([pendingAd], 'PENDING'),
    ));
    mocks.getManagedAdvertisement.mockResolvedValue({ data: {
      ...pendingAd,
      address: 'نشانی تست', price: '120000', images: ['https://example.test/ad.webp'],
      contactInfo: { phone: '09120000000', email: 'contact@example.com' },
    } });
    mocks.approveAdvertisement.mockResolvedValue({ data: { ...pendingAd, status: 'APPROVED' } });
    mocks.rejectAdvertisement.mockResolvedValue({ data: { ...pendingAd, status: 'REJECTED' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <ThemeProvider theme={createTheme({ direction: 'rtl' })}>
        <QueryClientProvider client={queryClient}>
          <AdvertisementModerationBoard showParkFilter />
        </QueryClientProvider>
      </ThemeProvider>,
    ));
    await waitFor(() => expect(document.body.textContent).toContain('آگهی تست محدوده'));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('renders paginated status data and safe media/contact detail including EXPIRED history', async () => {
    expect(mocks.getManagedAdvertisements).toHaveBeenCalledWith({ view: 'PENDING', page: 1, pageSize: 12 });
    await click(button('جزئیات'));
    await waitFor(() => expect(document.body.textContent).toContain('contact@example.com'));
    expect(document.body.textContent).toContain('09120000000');
    expect(document.querySelector('img[alt="تصویر 1 آگهی آگهی تست محدوده"]')).not.toBeNull();
    await click(button('بستن'));

    await click(button('تاریخچه تصمیم‌ها'));
    await waitFor(() => expect(document.body.textContent).toContain('آگهی منقضی'));
    expect(document.body.textContent).toContain('منقضی شده');
    expect(mocks.getManagedAdvertisements).toHaveBeenCalledWith({ view: 'HISTORY', page: 1, pageSize: 12 });
  });

  it('requires target confirmation, supports cancel, and never calls approval on cancel', async () => {
    await click(button('تایید'));
    expect(document.body.textContent).toContain('آگهی «آگهی تست محدوده» برای نمایش عمومی تایید شود؟');
    expect(mocks.approveAdvertisement).not.toHaveBeenCalled();
    await click(button('انصراف'));
    expect(mocks.approveAdvertisement).not.toHaveBeenCalled();
  });

  it('keeps a valid rejection reason after 409, refetches authority, disables duplicate actions, and emits no false success', async () => {
    const rejection = deferred();
    mocks.rejectAdvertisement.mockReturnValueOnce(rejection.promise);
    await click(button('رد'));
    const confirm = button('ثبت رد آگهی');
    expect(confirm.disabled).toBe(true);
    const field = await typeReason('  دلیل معتبر کاربر  ');
    expect(button('ثبت رد آگهی').disabled).toBe(false);

    await click(button('ثبت رد آگهی'));
    expect(mocks.rejectAdvertisement).toHaveBeenCalledWith('ad-pending', 'دلیل معتبر کاربر');
    expect(button('ثبت رد آگهی').disabled).toBe(true);
    expect(button('انصراف').disabled).toBe(true);
    rejection.reject({ response: { status: 409 } });
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('قبلاً بررسی شده'), 'error'));
    await waitFor(() => expect(mocks.getManagedAdvertisements.mock.calls.length).toBeGreaterThan(1));
    expect(field.value).toBe('  دلیل معتبر کاربر  ');
    expect(mocks.notify.mock.calls.some(([, severity]) => severity === 'success')).toBe(false);
  });

  it('blocks both open approval and rejection dialogs when connectivity drops', async () => {
    await click(button('تایید'));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await act(async () => window.dispatchEvent(new Event('offline')));
    await flush();
    expect(button('تایید و انتشار').disabled).toBe(true);
    await click(button('تایید و انتشار'));
    expect(mocks.approveAdvertisement).not.toHaveBeenCalled();
    expect(mocks.notify.mock.calls.some(([, severity]) => severity === 'success')).toBe(false);
    await click(button('انصراف'));

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await act(async () => window.dispatchEvent(new Event('online')));
    await flush();
    await click(button('رد'));
    await typeReason('دلیل آفلاین');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await act(async () => window.dispatchEvent(new Event('offline')));
    await flush();
    expect(button('ثبت رد آگهی').disabled).toBe(true);
    await click(button('ثبت رد آگهی'));
    expect(mocks.rejectAdvertisement).not.toHaveBeenCalled();
    expect(mocks.notify.mock.calls.some(([, severity]) => severity === 'success')).toBe(false);
  });
});
