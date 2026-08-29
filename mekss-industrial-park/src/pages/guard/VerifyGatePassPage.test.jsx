import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGatePass: vi.fn(),
  verifyGatePass: vi.fn(),
  denyGatePassExit: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../services/api/gatePass.api', () => ({
  gatePassApi: {
    getGatePass: mocks.getGatePass,
    verifyGatePass: mocks.verifyGatePass,
    denyGatePassExit: mocks.denyGatePassExit,
  },
}));
vi.mock('../../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));

import VerifyGatePassPage from './VerifyGatePassPage';

const approvedPass = {
  id: 'pass-1',
  status: 'APPROVED',
  driverName: 'راننده آزمون',
  licensePlate: '12ب34567',
  exitDate: '2027-01-01T00:00:00.000Z',
  cargoDescription: 'بار آزمون',
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

describe('VerifyGatePassPage', () => {
  let container;
  let root;
  let queryClient;

  beforeEach(async () => {
    vi.resetAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.getGatePass.mockResolvedValue({ data: approvedPass });
    mocks.verifyGatePass.mockResolvedValue({ data: { ...approvedPass, status: 'COMPLETED' } });
    mocks.denyGatePassExit.mockResolvedValue({ data: { ...approvedPass, status: 'REJECTED' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <ThemeProvider theme={createTheme({ direction: 'rtl' })}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/guard/gate-passes/pass-1/verify']}>
            <Routes>
              <Route path="/guard/gate-passes/:id/verify" element={<VerifyGatePassPage />} />
              <Route path="/guard/gate-passes" element={<div>لیست نگهبانی</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
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

  it('requires explicit confirmation before registering exit, and does not mutate on cancel', async () => {
    await click(button('ثبت خروج'));
    expect(document.body.textContent).toContain('12ب34567');
    expect(mocks.verifyGatePass).not.toHaveBeenCalled();

    await click(button('انصراف'));
    expect(mocks.verifyGatePass).not.toHaveBeenCalled();
  });

  it('verifies the exit only after the confirmation dialog is explicitly confirmed', async () => {
    await click(button('ثبت خروج'));
    const confirmButtons = [...document.querySelectorAll('button')].filter((el) => el.textContent?.trim() === 'ثبت خروج');
    await click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mocks.verifyGatePass).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('ثبت شد'), 'success'));
  });

  it('still requires a discrepancy reason before denying exit', async () => {
    await click(button('اعلام مغایرت'));
    const confirmDeny = button('ثبت مغایرت');
    expect(confirmDeny.disabled).toBe(true);

    const reasonField = document.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => {
      setter.call(reasonField, 'پلاک مطابقت ندارد');
      reasonField.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();

    await click(button('ثبت مغایرت'));
    await waitFor(() => expect(mocks.denyGatePassExit).toHaveBeenCalledWith('pass-1', { reason: 'پلاک مطابقت ندارد' }));
  });
});
