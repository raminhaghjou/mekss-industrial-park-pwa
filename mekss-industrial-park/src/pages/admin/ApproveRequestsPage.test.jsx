import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRequests: vi.fn(),
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../services/api/request.api', () => ({
  requestApi: {
    getRequests: mocks.getRequests,
    approveRequest: mocks.approveRequest,
    rejectRequest: mocks.rejectRequest,
  },
}));
vi.mock('../../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));

import ApproveRequestsPage from './ApproveRequestsPage';

const pendingRequest = {
  id: 'request-1',
  status: 'PENDING',
  title: 'درخواست آزمون',
  createdAt: '2027-01-01T00:00:00.000Z',
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

describe('ApproveRequestsPage', () => {
  let container;
  let root;
  let queryClient;

  beforeEach(async () => {
    vi.resetAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.getRequests.mockResolvedValue({ data: [pendingRequest] });
    mocks.approveRequest.mockResolvedValue({ data: { ...pendingRequest, status: 'APPROVED' } });
    mocks.rejectRequest.mockResolvedValue({ data: { ...pendingRequest, status: 'REJECTED' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <ThemeProvider theme={createTheme({ direction: 'rtl' })}>
        <QueryClientProvider client={queryClient}>
          <ApproveRequestsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    ));
    await waitFor(() => expect(document.body.textContent).toContain('درخواست آزمون'));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('requires explicit confirmation before approving a request, and does not mutate on cancel', async () => {
    const trigger = document.querySelector('svg[data-testid="CheckCircleIcon"]')?.closest('button');
    await click(trigger);

    expect(document.body.textContent).toContain('تایید درخواست');
    expect(mocks.approveRequest).not.toHaveBeenCalled();

    await click(button('انصراف'));
    expect(mocks.approveRequest).not.toHaveBeenCalled();
  });

  it('approves only after the confirmation dialog is explicitly confirmed', async () => {
    const trigger = document.querySelector('svg[data-testid="CheckCircleIcon"]')?.closest('button');
    await click(trigger);
    await click(button('تایید'));

    await waitFor(() => expect(mocks.approveRequest).toHaveBeenCalledWith('request-1'));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('تایید شد'), 'success'));
  });

  it('still requires a rejection reason and rejects only after confirming', async () => {
    const trigger = document.querySelector('svg[data-testid="CancelIcon"]')?.closest('button');
    await click(trigger);
    expect(document.body.textContent).toContain('رد درخواست');

    const confirmReject = button('رد کردن');
    expect(confirmReject.disabled).toBe(true);

    const reasonField = document.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => {
      setter.call(reasonField, 'عدم رعایت مقررات');
      reasonField.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();

    await click(button('رد کردن'));
    await waitFor(() => expect(mocks.rejectRequest).toHaveBeenCalledWith('request-1', { reason: 'عدم رعایت مقررات' }));
  });
});
