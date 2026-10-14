import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCaptcha: vi.fn(),
  submitSmsRequest: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../services/api/public.api', () => ({ publicApi: mocks }));
vi.mock('../../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));
vi.mock('../../components/public/PublicShell', () => ({
  PublicShell: ({ children }) => <div>{children}</div>,
}));

import { SmsRequestDemoPage } from './SmsRequestDemoPage';

const flush = async (ms = 0) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
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
const type = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('SmsRequestDemoPage captcha', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.clearAllMocks();
    let issued = 0;
    mocks.getCaptcha.mockImplementation(async () => {
      issued += 1;
      return { data: { captchaId: `captcha-${issued}`, image: 'data:image/png;base64,AA==', expiresIn: 180 } };
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <SmsRequestDemoPage />
        </QueryClientProvider>,
      );
    });
    await waitFor(() => expect(container.querySelector('img[alt="تصویر کد امنیتی"]')).not.toBeNull());
  };

  it('sends the captcha with the request and loads a fresh one afterwards', async () => {
    mocks.submitSmsRequest.mockResolvedValue({ data: { id: 'r1' } });
    await render();

    type(container.querySelector('input[type="tel"]'), '09121234567');
    const captchaInput = container.querySelector('input[aria-label="کد امنیتی"]');
    type(captchaInput, '۲۳۴۵۶');
    expect(captchaInput.value).toBe('23456');

    await act(async () => {
      container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await waitFor(() => expect(mocks.submitSmsRequest).toHaveBeenCalledTimes(1));
    expect(mocks.submitSmsRequest.mock.calls[0][0]).toMatchObject({
      phoneNumber: '09121234567',
      captchaId: 'captcha-1',
      captchaAnswer: '23456',
    });

    await waitFor(() => expect(mocks.getCaptcha).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(container.querySelector('input[aria-label="کد امنیتی"]').value).toBe(''));
  });

  it('blocks submission until the captcha is typed', async () => {
    await render();
    type(container.querySelector('input[type="tel"]'), '09121234567');
    await act(async () => {
      container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(mocks.submitSmsRequest).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith('کد امنیتی تصویر را وارد کنید', 'error');
  });
});
