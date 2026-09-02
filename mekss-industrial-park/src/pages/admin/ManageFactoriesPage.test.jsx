import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getManagedFactories: vi.fn(),
  getManagedFactory: vi.fn(),
  getManagementScope: vi.fn(),
  createFactory: vi.fn(),
  updateFactory: vi.fn(),
  approveFactory: vi.fn(),
  rejectFactory: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../services/api/factory.api', () => ({
  factoryApi: {
    getManagedFactories: mocks.getManagedFactories,
    getManagedFactory: mocks.getManagedFactory,
    getManagementScope: mocks.getManagementScope,
    createFactory: mocks.createFactory,
    updateFactory: mocks.updateFactory,
    approveFactory: mocks.approveFactory,
    rejectFactory: mocks.rejectFactory,
  },
}));
vi.mock('../../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));

import ManageFactoriesPage from './ManageFactoriesPage';

const pendingFactory = {
  id: 'factory-1',
  name: 'فولاد آزمون',
  licenseNumber: 'LIC-100',
  nationalId: '1234567890',
  activityType: 'فولاد',
  address: 'تهران، شهرک صنعتی',
  phoneNumber: '09120000000',
  phoneNumber2: '09120000001',
  landline: '02112345678',
  fax: '02187654321',
  email: 'factory@example.com',
  website: 'https://factory.example.com',
  description: 'توضیحات واحد',
  employees: 35,
  status: 'PENDING',
  isApproved: false,
  parkId: 'park-1',
  managerId: 'owner-1',
  rejectionReason: null,
  park: { id: 'park-1', name: 'شهرک آزمون' },
  manager: { id: 'owner-1', name: 'مالک آزمون' },
};
const managedPage = { data: { items: [pendingFactory], total: 1, page: 1, pageSize: 12 } };
const managementScope = { data: {
  parks: [{ id: 'park-1', name: 'شهرک آزمون' }],
  owners: [{ id: 'owner-1', name: 'مالک آزمون', phoneNumber: '09121111111' }],
} };

const deferred = () => {
  let resolve = /** @type {(value?: any) => void} */ (() => {});
  let reject = /** @type {(reason?: any) => void} */ (() => {});
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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
  if (!element) throw new Error('button not found');
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await flush();
};
const field = (label) => {
  const labelElement = [...document.querySelectorAll('label')].find((element) => element.textContent?.replace(/[\s*]+$/, '').trim() === label);
  const input = labelElement?.htmlFor ? document.getElementById(labelElement.htmlFor) : labelElement?.querySelector('input, textarea') || document.querySelector(`input[aria-label="${label}"], textarea[aria-label="${label}"]`);
  if (!input) throw new Error(`field not found: ${label}`);
  return /** @type {HTMLInputElement | HTMLTextAreaElement} */ (input);
};
const setValue = async (element, value) => {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  await act(async () => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flush();
};
const choose = async (label, option) => {
  const labelElement = [...document.querySelectorAll('label')].filter((element) => element.textContent?.replace(/[\s*]+$/, '').trim() === label).at(-1);
  const select = labelElement?.htmlFor ? document.getElementById(labelElement.htmlFor) : labelElement?.closest('button') || labelElement?.parentElement?.querySelector('button');
  if (select) {
    await act(async () => select.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await flush();
  }
  const item = [...document.querySelectorAll('[role="option"], li')].find((element) => element.textContent?.trim() === option);
  if (item) await click(item);
};
const typeReason = async (value) => {
  const reasonField = /** @type {HTMLTextAreaElement} */ (document.querySelector('textarea'));
  await setValue(reasonField, value);
  return reasonField;
};

describe('ManageFactoriesPage', () => {
  let container;
  let root;
  let queryClient;

  beforeEach(async () => {
    vi.resetAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.getManagedFactories.mockResolvedValue(managedPage);
    mocks.getManagedFactory.mockResolvedValue({ data: pendingFactory });
    mocks.getManagementScope.mockResolvedValue(managementScope);
    mocks.createFactory.mockResolvedValue({ data: { ...pendingFactory, id: 'factory-new' } });
    mocks.updateFactory.mockResolvedValue({ data: pendingFactory });
    mocks.approveFactory.mockResolvedValue({ data: { ...pendingFactory, status: 'ACTIVE' } });
    mocks.rejectFactory.mockResolvedValue({ data: { ...pendingFactory, status: 'INACTIVE' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <QueryClientProvider client={queryClient}>
        <ManageFactoriesPage />
      </QueryClientProvider>,
    ));
    await act(async () => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(document.body.textContent).toContain('فولاد آزمون'));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('uses paginated managed data and opens an explicit authoritative detail dialog', async () => {
    expect(mocks.getManagedFactories).toHaveBeenCalledWith({ page: 1, pageSize: 12 });
    await click(button('جزئیات'));
    await waitFor(() => expect(mocks.getManagedFactory).toHaveBeenCalledWith('factory-1'));
    expect(document.body.textContent).toContain('شناسه ملی');
    expect(document.body.textContent).toContain('factory@example.com');
  });

  it('requires target-specific approval confirmation, supports cancel, and globally locks duplicate submissions', async () => {
    await click(button('تایید'));
    expect(document.body.textContent).toContain('«فولاد آزمون» تایید شود؟');
    await click(button('انصراف'));
    expect(mocks.approveFactory).not.toHaveBeenCalled();

    const approval = deferred();
    mocks.approveFactory.mockReturnValueOnce(approval.promise);
    await click(button('تایید'));
    const confirm = button('تایید واحد صنعتی');
    await act(async () => {
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();
    expect(mocks.approveFactory).toHaveBeenCalledTimes(1);
    expect(button('تایید واحد صنعتی').disabled).toBe(true);
    expect(button('انصراف').disabled).toBe(true);
    approval.resolve({ data: { ...pendingFactory, status: 'ACTIVE' } });
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('تایید واحد صنعتی'), 'success'));
  });

  it('disables already-open form and confirmation mutations on offline transition while preserving input', async () => {
    await click(button('ثبت واحد جدید'));
    const nameField = field('نام واحد صنعتی');
    await setValue(nameField, 'پیش‌نویس آفلاین');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await act(async () => window.dispatchEvent(new Event('offline')));
    await flush();
    expect(button('ثبت واحد صنعتی').disabled).toBe(true);
    expect(nameField.value).toBe('پیش‌نویس آفلاین');
    expect(mocks.createFactory).not.toHaveBeenCalled();
    await click(button('انصراف'));

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await act(async () => window.dispatchEvent(new Event('online')));
    await flush();
    await click(button('تایید'));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await act(async () => window.dispatchEvent(new Event('offline')));
    await flush();
    expect(button('تایید واحد صنعتی').disabled).toBe(true);
    await click(button('تایید واحد صنعتی'));
    expect(mocks.approveFactory).not.toHaveBeenCalled();
    expect(mocks.notify.mock.calls.some(([, severity]) => severity === 'success')).toBe(false);
  });

  it('trims rejection reason, reconciles a 409, preserves input, and never emits false success', async () => {
    const rejection = deferred();
    mocks.rejectFactory.mockReturnValueOnce(rejection.promise);
    await click(button('رد'));
    const reasonField = await typeReason('  مدارک مجوز ناقص است  ');
    await click(button('ثبت رد واحد صنعتی'));
    expect(mocks.rejectFactory).toHaveBeenCalledWith('factory-1', 'مدارک مجوز ناقص است');
    rejection.reject({ response: { status: 409 } });
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('هم‌زمان تغییر کرده'), 'error'));
    await waitFor(() => expect(mocks.getManagedFactories.mock.calls.length).toBeGreaterThan(1));
    expect(reasonField.value).toBe('  مدارک مجوز ناقص است  ');
    expect(mocks.notify.mock.calls.some(([, severity]) => severity === 'success')).toBe(false);
  });

  it('reconciles a 404 authority response and reports only the error', async () => {
    mocks.approveFactory.mockRejectedValueOnce({ response: { status: 404 } });
    await click(button('تایید'));
    await click(button('تایید واحد صنعتی'));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('پیدا نشد'), 'error'));
    await waitFor(() => expect(mocks.getManagedFactories.mock.calls.length).toBeGreaterThan(1));
    expect(mocks.notify.mock.calls.some(([, severity]) => severity === 'success')).toBe(false);
  });

  it('waits for every authoritative cache invalidation before announcing success', async () => {
    const invalidation = deferred();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => invalidation.promise);
    await click(button('تایید'));
    await click(button('تایید واحد صنعتی'));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(6));
    expect(mocks.notify.mock.calls.some(([, severity]) => severity === 'success')).toBe(false);

    const invalidations = invalidateSpy.mock.calls.map(([filters]) => filters);
    expect(invalidations).toEqual(expect.arrayContaining([
      expect.objectContaining({ queryKey: ['factories', 'managed'] }),
      expect.objectContaining({ queryKey: ['factories', 'managed', 'detail', 'factory-1'] }),
      expect.objectContaining({ queryKey: ['analytics', 'dashboard'] }),
      expect.objectContaining({ queryKey: ['factories', 'management-scope'] }),
      expect.objectContaining({ queryKey: ['factories', 'managed'], exact: true }),
    ]));
    invalidation.resolve();
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('تایید واحد صنعتی'), 'success'));
  });

  it('whitelists create and edit payloads so lifecycle and assignment fields never leak into profile updates', async () => {
    await click(button('ثبت واحد جدید'));
    const values = {
      'نام واحد صنعتی': 'واحد جدید',
      'شماره مجوز': 'NEW-LIC',
      'شناسه ملی': '0987654321',
      'نوع فعالیت': 'بسته‌بندی',
      'تلفن همراه': '09123333333',
      'تلفن همراه دوم': '09124444444',
      'تلفن ثابت': '02111111111',
      'نمابر': '02122222222',
      'ایمیل': 'new@example.com',
      'وب‌سایت': 'https://new.example.com',
      'تعداد کارکنان': '18',
      'نشانی': 'نشانی واحد جدید',
      'توضیحات': 'توضیحات جدید',
    };
    for (const [label, value] of Object.entries(values)) await setValue(field(label), value);
    await choose('شهرک صنعتی', 'شهرک آزمون');
    await choose('مالک / مدیر واحد', 'مالک آزمون');
    await click(button('ثبت واحد صنعتی'));
    await waitFor(() => expect(mocks.createFactory).toHaveBeenCalledTimes(1));
    expect(mocks.createFactory).toHaveBeenCalledWith({
      name: 'واحد جدید', licenseNumber: 'NEW-LIC', nationalId: '0987654321', activityType: 'بسته‌بندی',
      address: 'نشانی واحد جدید', phoneNumber: '09123333333', phoneNumber2: '09124444444',
      landline: '02111111111', fax: '02122222222', email: 'new@example.com', website: 'https://new.example.com',
      description: 'توضیحات جدید', employees: 18, parkId: 'park-1', managerId: 'owner-1',
    });

    await waitFor(() => expect(button('ویرایش')).not.toBeUndefined());
    await click(button('ویرایش'));
    await waitFor(() => expect(button('ذخیره تغییرات')).not.toBeUndefined());
    expect(mocks.getManagedFactory).toHaveBeenCalledWith('factory-1');
    await setValue(field('ایمیل'), '');
    await setValue(field('توضیحات'), '');
    await setValue(field('تعداد کارکنان'), '');
    await click(button('ذخیره تغییرات'));
    await waitFor(() => expect(mocks.updateFactory).toHaveBeenCalledTimes(1));
    const [, updatePayload] = mocks.updateFactory.mock.calls[0];
    expect(mocks.updateFactory.mock.calls[0][0]).toBe('factory-1');
    expect(updatePayload).toEqual({
      name: pendingFactory.name,
      licenseNumber: pendingFactory.licenseNumber,
      nationalId: pendingFactory.nationalId,
      activityType: pendingFactory.activityType,
      address: pendingFactory.address,
      phoneNumber: pendingFactory.phoneNumber,
      phoneNumber2: pendingFactory.phoneNumber2,
      landline: pendingFactory.landline,
      fax: pendingFactory.fax,
      email: null,
      website: pendingFactory.website,
      description: null,
      employees: 0,
    });
    expect(updatePayload).not.toHaveProperty('status');
    expect(updatePayload).not.toHaveProperty('isApproved');
    expect(updatePayload).not.toHaveProperty('parkId');
    expect(updatePayload).not.toHaveProperty('managerId');
    expect(updatePayload).not.toHaveProperty('rejectionReason');
  });
});

