import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getStaff: vi.fn(),
  createStaff: vi.fn(),
  updateStaff: vi.fn(),
  deleteStaff: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../services/api/factory.api', () => ({
  factoryApi: {
    getStaff: mocks.getStaff,
    createStaff: mocks.createStaff,
    updateStaff: mocks.updateStaff,
    deleteStaff: mocks.deleteStaff,
  },
}));
vi.mock('../../providers/ActiveFactoryProvider', () => ({
  useActiveFactory: () => ({
    activeFactoryId: 'factory-1',
    activeFactory: { id: 'factory-1', name: 'فولاد آزمون' },
    factories: [{ id: 'factory-1', name: 'فولاد آزمون' }],
    isLoading: false,
  }),
}));
vi.mock('../../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));

import FactoryStaffPage from './FactoryStaffPage';

const member = {
  id: 'staff-1',
  name: 'رضا کارمند',
  phoneNumber: '09125556666',
  canApproveRequestTypes: [],
  isActive: true,
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
const byLabel = (label) => document.querySelector(`button[aria-label="${label}"]`);
const click = async (element) => {
  if (!element) throw new Error('button not found');
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await flush();
};
const setValue = async (element, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flush();
};

describe('FactoryStaffPage staff maintenance', () => {
  let container;
  let root;
  let queryClient;

  beforeEach(async () => {
    vi.resetAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.getStaff.mockResolvedValue({ data: [member] });
    mocks.updateStaff.mockResolvedValue({ data: member });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <QueryClientProvider client={queryClient}>
        <FactoryStaffPage />
      </QueryClientProvider>,
    ));
    await waitFor(() => expect(document.body.textContent).toContain('رضا کارمند'));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('sends only the changed fields when editing a staff member', async () => {
    await click(byLabel('ویرایش رضا کارمند'));
    await setValue(document.getElementById('factory-staff-edit-phone'), '09127778888');
    await click(button('ذخیره'));
    await waitFor(() => expect(mocks.updateStaff).toHaveBeenCalledWith('factory-1', 'staff-1', { phoneNumber: '09127778888' }));
  });

  it('blocks an invalid phone number in the edit dialog', async () => {
    await click(byLabel('ویرایش رضا کارمند'));
    await setValue(document.getElementById('factory-staff-edit-phone'), '0912');
    expect(button('ذخیره').disabled).toBe(true);
    expect(mocks.updateStaff).not.toHaveBeenCalled();
  });

  it('resets the password with a strong generated password', async () => {
    await click(byLabel('بازنشانی رمز رضا کارمند'));
    await click(button('بازنشانی رمز'));
    await waitFor(() => expect(mocks.updateStaff).toHaveBeenCalledTimes(1));
    const [, , payload] = mocks.updateStaff.mock.calls[0];
    expect(Object.keys(payload)).toEqual(['password']);
    expect(payload.password).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{10,128}$/);
  });

  it('explains when a staff member with history is deactivated instead of deleted', async () => {
    mocks.deleteStaff.mockResolvedValueOnce({ data: { id: 'staff-1', deleted: false, deactivated: true } });
    await click(byLabel('حذف رضا کارمند'));
    await click(button('حذف'));
    expect(mocks.deleteStaff).toHaveBeenCalledWith('factory-1', 'staff-1');
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('غیرفعال شد'), 'warning'));
  });
});
