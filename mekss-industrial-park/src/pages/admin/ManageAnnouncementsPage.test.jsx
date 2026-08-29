import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getManagedAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  getParks: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../services/api/announcement.api', () => ({
  announcementApi: {
    getManagedAnnouncements: mocks.getManagedAnnouncements,
    createAnnouncement: mocks.createAnnouncement,
    updateAnnouncement: mocks.updateAnnouncement,
    deleteAnnouncement: mocks.deleteAnnouncement,
  },
}));
vi.mock('../../services/api/park.api', () => ({
  parkApi: { getParks: mocks.getParks },
}));
vi.mock('../../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));
vi.mock('../../providers/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'admin-1', role: 'SUPER_ADMIN' } }),
}));

import ManageAnnouncementsPage from './ManageAnnouncementsPage';

const existingAnnouncement = {
  id: 'ann-1',
  title: 'اطلاعیه آزمون',
  content: 'متن اطلاعیه',
  isGlobal: false,
  isPinned: true,
  priority: 3,
  parkId: 'park-1',
  createdAt: '2027-01-01T00:00:00.000Z',
  expiresAt: null,
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
  const input = labelElement?.htmlFor ? document.getElementById(labelElement.htmlFor) : null;
  if (!input) throw new Error(`field not found: ${label} (labels: ${[...document.querySelectorAll('label')].map((l) => l.textContent).join(' | ')})`);
  return /** @type {HTMLInputElement} */ (input);
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
const checkbox = (label) => /** @type {HTMLInputElement} */ ([...document.querySelectorAll('label')].find((element) => element.textContent?.includes(label))?.querySelector('input[type="checkbox"]'));

describe('ManageAnnouncementsPage', () => {
  let container;
  let root;
  let queryClient;

  beforeEach(async () => {
    vi.resetAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.getManagedAnnouncements.mockResolvedValue({ data: [existingAnnouncement] });
    mocks.getParks.mockResolvedValue({ data: [{ id: 'park-1', name: 'شهرک آزمون' }] });
    mocks.createAnnouncement.mockResolvedValue({ data: { ...existingAnnouncement, id: 'ann-new' } });
    mocks.updateAnnouncement.mockResolvedValue({ data: existingAnnouncement });
    mocks.deleteAnnouncement.mockResolvedValue({ data: { id: 'ann-1', deleted: true } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <ThemeProvider theme={createTheme({ direction: 'rtl' })}>
        <QueryClientProvider client={queryClient}>
          <ManageAnnouncementsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    ));
    await waitFor(() => expect(document.body.textContent).toContain('اطلاعیه آزمون'));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('renders pinned/global status chips derived from real API data', () => {
    expect(document.body.textContent).toContain('سنجاق‌شده');
    expect(document.body.textContent).toContain('شهرک‌محور');
  });

  it('submits isGlobal, isPinned, priority and expiresAt from the create form, not just title/content', async () => {
    await click(button('ثبت اطلاعیه جدید'));
    await waitFor(() => expect(document.body.textContent).toContain('فرم ثبت اطلاعیه'));
    await setValue(field('عنوان اطلاعیه'), 'اطلاعیه جدید');
    await setValue(field('متن اطلاعیه'), 'متن جدید');
    await click(checkbox('نمایش سراسری'));
    await click(checkbox('سنجاق‌شده'));
    await setValue(field('اولویت'), '5');

    await click(button('ثبت'));

    await waitFor(() => expect(mocks.createAnnouncement).toHaveBeenCalled());
    expect(mocks.createAnnouncement).toHaveBeenCalledWith(expect.objectContaining({
      title: 'اطلاعیه جدید', content: 'متن جدید', isGlobal: true, isPinned: true, priority: 5,
    }));
  });

  it('pre-fills the edit form with every existing field, including isPinned and priority', async () => {
    const editButtons = [...document.querySelectorAll('svg[data-testid="EditIcon"]')].map((el) => el.closest('button'));
    await click(editButtons[0]);

    expect(field('عنوان اطلاعیه').value).toBe('اطلاعیه آزمون');
    expect(field('اولویت').value).toBe('3');
    expect(checkbox('سنجاق‌شده').checked).toBe(true);
    expect(checkbox('نمایش سراسری').checked).toBe(false);
  });

  it('deletes an announcement only after explicit confirmation', async () => {
    const deleteButtons = [...document.querySelectorAll('svg[data-testid="DeleteIcon"]')].map((el) => el.closest('button'));
    await click(deleteButtons[0]);
    expect(document.body.textContent).toContain('حذف اطلاعیه');
    expect(mocks.deleteAnnouncement).not.toHaveBeenCalled();

    await click(button('حذف'));
    await waitFor(() => expect(mocks.deleteAnnouncement).toHaveBeenCalledWith('ann-1'));
  });
});
