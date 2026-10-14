import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getInbox: vi.fn(),
  user: { id: 'admin-1', role: 'SUPER_ADMIN' },
}));

vi.mock('../../services/api/feedback.api', () => ({
  feedbackApi: { getInbox: mocks.getInbox },
}));
vi.mock('../../providers/AuthProvider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

import FeedbackInboxPage from './FeedbackInboxPage';

const item = {
  id: 'fb-1',
  subject: 'روشنایی خیابان',
  body: 'چراغ‌های خیابان اصلی خاموش است.',
  createdAt: '2026-10-01T08:00:00.000Z',
  recipientPark: { id: 'park-1', name: 'شهرک آزمون' },
  sender: {
    id: 'u-1',
    name: 'علی رضایی',
    phoneNumber: '09121234567',
    role: 'FACTORY_OWNER',
    managedFactories: [{ id: 'f-1', name: 'فولاد آزمون' }],
    employeeOfFactory: null,
  },
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

describe('FeedbackInboxPage', () => {
  let container;
  let root;
  let queryClient;

  const render = async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <QueryClientProvider client={queryClient}>
        <FeedbackInboxPage />
      </QueryClientProvider>,
    ));
  };

  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.user = { id: 'admin-1', role: 'SUPER_ADMIN' };
    mocks.getInbox.mockResolvedValue({ data: { items: [item], total: 1, page: 1, pageSize: 20 } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('shows the feedback with its sender, unit and destination park', async () => {
    await render();
    await waitFor(() => expect(document.body.textContent).toContain('روشنایی خیابان'));
    expect(mocks.getInbox).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(document.body.textContent).toContain('علی رضایی');
    expect(document.body.textContent).toContain('فولاد آزمون');
    expect(document.body.textContent).toContain('شهرک آزمون');
    expect(document.querySelector('a[href="tel:09121234567"]')).not.toBeNull();
  });

  it('lets a super admin filter by destination and resets to the first page', async () => {
    await render();
    await waitFor(() => expect(document.body.textContent).toContain('روشنایی خیابان'));
    await click(button('مدیریت سامانه'));
    await waitFor(() => expect(mocks.getInbox).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, target: 'PLATFORM' }));
  });

  it('hides the destination filter from park managers', async () => {
    mocks.user = { id: 'pm-1', role: 'PARK_MANAGER' };
    await render();
    await waitFor(() => expect(document.body.textContent).toContain('روشنایی خیابان'));
    expect(document.querySelector('[aria-label="مقصد نظر"]')).toBeNull();
  });
});
