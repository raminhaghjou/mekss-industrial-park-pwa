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

vi.mock('../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

import { DashboardLayout } from './DashboardLayout';

describe('DashboardLayout mobile shell', () => {
  let container;
  let root;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<div>محتوای داشبورد</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('renders the mobile bottom navigation and opens the full menu drawer', async () => {
    expect(document.querySelector('[aria-label="ناوبری موبایل"]')).toBeTruthy();
    expect(document.body.textContent).toContain('قبض‌های من');
    expect(document.body.textContent).toContain('منو');

    const openMenu = document.querySelector('[aria-label="باز کردن منو"]');
    await act(async () => {
      openMenu?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('خروج از حساب');
  });
});
