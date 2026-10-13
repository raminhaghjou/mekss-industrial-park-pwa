import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchServices, servicesForRole } from '../../constants/appServices';
import { ServiceGrid } from './ServiceGrid';

describe('ServiceGrid', () => {
  let container;
  let root;
  const services = servicesForRole('PARK_MANAGER');

  const render = async (props) => {
    await act(async () => root.render(<ServiceGrid services={services} onOpen={vi.fn()} {...props} />));
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
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('groups services under headings and opens the tapped one', async () => {
    const onOpen = vi.fn();
    await render({ onOpen });
    const headings = [...container.querySelectorAll('h2')].map((heading) => heading.textContent);
    expect(headings).toEqual(expect.arrayContaining(['تردد و برگ خروج', 'مالی و پرداخت', 'واحدها و پرسنل']));
    expect(container.querySelector('[data-testid="service-tile-parks"]')).toBeNull();

    await act(async () => {
      container.querySelector('[data-testid="service-tile-finance"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ path: '/admin/finance' }));
  });

  it('shows counters only for services with pending work', async () => {
    await render({ badges: { pendingGatePasses: 3, pendingRequests: 0, unreadMessages: 120 } });
    expect(container.querySelector('[data-testid="service-badge-gate-passes-approve"]').textContent).toBe('۳');
    expect(container.querySelector('[data-testid="service-badge-messages"]').textContent).toBe('۹۹+');
    expect(container.querySelector('[data-testid="service-badge-admin-requests"]')).toBeNull();
    expect(container.querySelector('[data-testid="service-tile-gate-passes-approve"]').getAttribute('aria-label')).toContain('۳ مورد جدید');
  });

  it('lists search matches flat and explains when nothing matches', async () => {
    await render({ services: searchServices(services, 'قبض'), searching: true });
    expect(container.querySelector('[aria-label="نتایج جستجو"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="service-tile-invoices"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="service-tile-factories"]')).toBeNull();

    await render({ services: [], searching: true });
    expect(container.textContent).toContain('خدمتی پیدا نشد');
  });
});
