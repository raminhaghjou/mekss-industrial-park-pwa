import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toast } from '@heroui/react';
import { NotificationProvider, useNotification } from './NotificationProvider';

let notify;
const Capture = () => {
  notify = useNotification().showNotification;
  return null;
};

const flush = async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
};

describe('NotificationProvider', () => {
  let container;
  let root;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    if (typeof window.matchMedia !== 'function') {
      window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      });
    }
    if (typeof globalThis.ResizeObserver !== 'function') {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<NotificationProvider><Capture /></NotificationProvider>));
  });

  afterEach(async () => {
    await act(async () => toast.clear());
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('actually renders error and success messages on screen', async () => {
    await act(async () => notify('ذخیره بنر ناموفق بود.', 'error'));
    await flush();
    expect(document.body.textContent).toContain('ذخیره بنر ناموفق بود.');

    await act(async () => notify('بنر جدید ثبت شد.', 'success'));
    await flush();
    expect(document.body.textContent).toContain('بنر جدید ثبت شد.');
  });

  it('ignores empty messages', async () => {
    await act(async () => notify('   ', 'error'));
    await flush();
    expect(document.querySelectorAll('[role="alertdialog"], [role="alert"]').length).toBe(0);
  });
});
