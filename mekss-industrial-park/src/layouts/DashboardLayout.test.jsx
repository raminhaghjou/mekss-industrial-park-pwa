import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'کاربر تست', role: 'FACTORY_OWNER' },
    logout: vi.fn(),
  }),
}));

vi.mock('../providers/ActiveFactoryProvider', () => ({
  useActiveFactory: () => ({
    factories: [{ id: 'f1', name: 'واحد تست' }],
    activeFactory: { id: 'f1', name: 'واحد تست' },
    activeFactoryId: 'f1',
    setActiveFactoryId: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

vi.mock('../services/api/message.api', () => ({
  messageApi: {
    getUnreadCount: () => Promise.resolve({ data: { count: 0 } }),
  },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ data: { count: 0 } }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

import { DashboardLayout } from './DashboardLayout';

describe('DashboardLayout mobile shell', () => {
  let container;
  let root;

  const renderAt = async (path) => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<div>محتوای داشبورد</div>} />
              <Route path="/invoices" element={<div>صفحه قبض</div>} />
              <Route path="/messages" element={<div>صفحه پیام</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });
  };

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('shows four fixed tabs instead of a sidebar or menu drawer', async () => {
    await renderAt('/dashboard');
    const mobileNav = document.querySelector('[aria-label="ناوبری موبایل"]');
    expect(mobileNav).toBeTruthy();
    expect(mobileNav.querySelectorAll('button')).toHaveLength(4);
    expect(mobileNav.textContent).toContain('خانه');
    expect(mobileNav.textContent).toContain('پیام‌ها');
    expect(mobileNav.textContent).toContain('اضطراری');
    expect(mobileNav.textContent).toContain('پروفایل');
    expect(document.querySelector('[data-testid="tab-home"]').getAttribute('aria-current')).toBe('page');

    expect(document.querySelector('aside')).toBeNull();
    expect(document.querySelector('[aria-label="باز کردن منو"]')).toBeNull();
    expect(document.querySelector('[data-testid="back-button"]')).toBeNull();
    expect(document.body.textContent).toContain('MEKSS');
  });

  it('titles inner pages and offers a way back', async () => {
    await renderAt('/invoices');
    expect(document.querySelector('header h1')?.textContent).toBe('قبض‌های من');
    expect(document.querySelector('[data-testid="back-button"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="tab-home"]').getAttribute('aria-current')).toBeNull();
  });

  it('navigates with the bottom tabs', async () => {
    await renderAt('/dashboard');
    await act(async () => {
      document.querySelector('[data-testid="tab-messages"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('صفحه پیام');
    expect(document.querySelector('[data-testid="tab-messages"]').getAttribute('aria-current')).toBe('page');
  });
});
