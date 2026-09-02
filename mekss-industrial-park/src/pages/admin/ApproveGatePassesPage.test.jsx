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
  licensePlate: '12ب34567',
  exitDate: '2027-01-01T00:00:00.000Z',
  factory: { name: 'کارخانه آزمون' },
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

  it('requires explicit confirmation before approving a gate pass, and does not mutate on cancel', async () => {
    const actionButtons = document.querySelectorAll('table button');
    const trigger = actionButtons[0];
    await click(trigger);

    expect(document.body.textContent).toContain('تایید برگ خروج');
    expect(mocks.approveGatePass).not.toHaveBeenCalled();

    await click(button('انصراف'));
    expect(mocks.approveGatePass).not.toHaveBeenCalled();
  });

  it('approves only after the confirmation dialog is explicitly confirmed', async () => {
    const actionButtons = document.querySelectorAll('table button');
    const trigger = actionButtons[0];
    await click(trigger);
    const confirm = button('تایید');
    await click(confirm);

    await waitFor(() => expect(mocks.approveGatePass).toHaveBeenCalledWith('pass-1'));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('تایید شد'), 'success'));
  });

  it('still requires a rejection reason and rejects only after confirming', async () => {
    const actionButtons = document.querySelectorAll('table button');
    const trigger = actionButtons[1];
    await click(trigger);
    expect(document.body.textContent).toContain('رد برگ خروج');

    const confirmReject = button('رد کردن');
    expect(confirmReject.disabled).toBe(true);

    const reasonField = document.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => {
      setter.call(reasonField, 'نامعتبر بودن مدارک');
      reasonField.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();

    await click(button('رد کردن'));
    await waitFor(() => expect(mocks.rejectGatePass).toHaveBeenCalledWith('pass-1', { reason: 'نامعتبر بودن مدارک' }));
  });
});

