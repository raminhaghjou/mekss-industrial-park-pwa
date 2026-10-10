import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGatePasses: vi.fn(),
  approveGatePass: vi.fn(),
  rejectGatePass: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../services/api/gatePass.api', () => ({
  gatePassApi: {
    getGatePasses: mocks.getGatePasses,
    approveGatePass: mocks.approveGatePass,
    rejectGatePass: mocks.rejectGatePass,
  },
}));
vi.mock('../../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));

import ApproveGatePassesPage from './ApproveGatePassesPage';

const pendingPass = {
  id: 'pass-1',
  status: 'PENDING',
  driverName: 'راننده آزمون',
  driverNationalId: '0012345678',
  driverPhone: '09120000000',
  licensePlate: '12ب34567',
  cargoType: 'FINISHED_GOODS',
  cargoDescription: 'ده پالت محصول',
  exitDate: '2027-01-01T00:00:00.000Z',
  createdAt: '2026-12-31T08:00:00.000Z',
  factory: { name: 'کارخانه آزمون' },
  createdBy: { name: 'مدیر واحد آزمون', phoneNumber: '09121111111' },
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
const button = (label) => [...document.querySelectorAll('button')].filter((element) => element.textContent?.trim() === label).pop();
const click = async (element) => {
  if (!element) throw new Error('button not found');
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await flush();
};

describe('ApproveGatePassesPage', () => {
  let container;
  let root;
  let queryClient;

  beforeEach(async () => {
    vi.resetAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.getGatePasses.mockResolvedValue({ data: [pendingPass] });
    mocks.approveGatePass.mockResolvedValue({ data: { ...pendingPass, status: 'APPROVED' } });
    mocks.rejectGatePass.mockResolvedValue({ data: { ...pendingPass, status: 'REJECTED' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <QueryClientProvider client={queryClient}>
        <ApproveGatePassesPage />
      </QueryClientProvider>,
    ));
    await waitFor(() => expect(document.body.textContent).toContain('راننده آزمون'));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('shows the pending pass to the park manager with its full details and review actions', () => {
    const text = document.body.textContent;
    expect(text).toContain('در انتظار تایید شما');
    expect(text).toContain('کارخانه آزمون');
    expect(text).toContain('0012345678');
    expect(text).toContain('09120000000');
    expect(text).toContain('ده پالت محصول');
    expect(text).toContain('مدیر واحد آزمون');
    expect(button('تایید و ارسال به نگهبانی')).toBeTruthy();
    expect(button('رد برگ خروج')).toBeTruthy();
  });

  it('approves only after explicit confirmation and forwards the pass to the guard', async () => {
    await click(button('تایید و ارسال به نگهبانی'));
    expect(mocks.approveGatePass).not.toHaveBeenCalled();

    await click(button('تایید و ارسال'));
    await waitFor(() => expect(mocks.approveGatePass).toHaveBeenCalledWith('pass-1'));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('نگهبانی'), 'success'));
  });

  it('requires a reason before rejecting', async () => {
    await click(button('رد برگ خروج'));
    expect(button('ثبت رد').disabled).toBe(true);

    const reasonField = document.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => {
      setter.call(reasonField, 'مدارک بار ناقص است');
      reasonField.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();

    await click(button('ثبت رد'));
    await waitFor(() => expect(mocks.rejectGatePass).toHaveBeenCalledWith('pass-1', { reason: 'مدارک بار ناقص است' }));
    expect(mocks.approveGatePass).not.toHaveBeenCalled();
  });

  it('hides review actions for passes already sent to the guard', async () => {
    mocks.getGatePasses.mockResolvedValue({ data: [{ ...pendingPass, status: 'APPROVED', approvedBy: { name: 'مدیر شهرک' } }] });
    await act(async () => queryClient.invalidateQueries());
    await click([...document.querySelectorAll('button')].find((el) => el.textContent?.includes('ارسال‌شده به نگهبانی')));
    await waitFor(() => expect(document.body.textContent).toContain('مدیر شهرک'));
    expect(button('تایید و ارسال به نگهبانی')).toBeUndefined();
  });
});
