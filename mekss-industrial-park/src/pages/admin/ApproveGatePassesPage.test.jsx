import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGatePasses: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../services/api/gatePass.api', () => ({
  gatePassApi: {
    getGatePasses: mocks.getGatePasses,
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

describe('ApproveGatePassesPage', () => {
  let container;
  let root;
  let queryClient;

  beforeEach(async () => {
    vi.resetAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.getGatePasses.mockResolvedValue({ data: [pendingPass] });
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

  it('shows a view-only list without approve or reject actions for park managers', async () => {
    expect(document.body.textContent).toContain('تایید فقط توسط نگهبان');
    expect(document.body.textContent).toContain('در انتظار نگهبان');
    expect(document.body.textContent).toContain('کارخانه آزمون');
    expect(document.querySelectorAll('table button')).toHaveLength(0);
  });
});
