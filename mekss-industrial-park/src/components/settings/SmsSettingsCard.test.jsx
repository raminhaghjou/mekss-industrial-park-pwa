import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  sendTest: vi.fn(),
  getCredit: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../services/api/sms.api', () => ({ smsApi: mocks }));
vi.mock('../../providers/NotificationProvider', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));

import { SmsSettingsCard } from './SmsSettingsCard';
import { buildSmsSettingsPayload } from '../../utils/smsSettings';

const settings = {
  provider: 'melipayamak',
  providerSource: 'database',
  configured: true,
  melipayamak: { username: 'meli-user', sender: '50001234', otpBodyId: '1234', hasPassword: true, passwordSource: 'database', passwordUnreadable: false },
  kavenegar: { configured: false },
  encryptionKeySource: 'SETTINGS_ENCRYPTION_KEY',
};

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

describe('buildSmsSettingsPayload', () => {
  it('omits an empty API key so the stored one is kept, and normalises Persian digits', () => {
    expect(buildSmsSettingsPayload({ provider: 'melipayamak', username: ' u ', password: '  ', sender: '۵۰۰۰۱', otpBodyId: '۱۲' })).toEqual({
      provider: 'melipayamak',
      melipayamakUsername: 'u',
      melipayamakSender: '50001',
      melipayamakOtpBodyId: '12',
    });
    expect(buildSmsSettingsPayload({ provider: 'melipayamak', username: '', password: 'key', sender: '', otpBodyId: '' }).melipayamakPassword).toBe('key');
  });
});

describe('SmsSettingsCard', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ data: settings });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the stored configuration without ever rendering the API key', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <SmsSettingsCard />
        </QueryClientProvider>,
      );
    });
    await waitFor(() => expect(container.querySelector('[data-testid="sms-setting-state"]')?.textContent).toContain('آماده ارسال'));
    const values = [...container.querySelectorAll('input')].map((input) => input.value);
    expect(values).toEqual(expect.arrayContaining(['meli-user', '50001234', '1234']));
    expect(container.querySelector('input[type="password"]').value).toBe('');
    expect(container.textContent).toContain('کلید ثبت شده است');
    expect(container.querySelector('[role="radio"][aria-checked="true"]').textContent).toBe('ملی پیامک');
  });
});
