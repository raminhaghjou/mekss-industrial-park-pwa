import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretBox } from '../secret-box';
import { SmsGateway } from '../sms.gateway';
import { MELIPAYAMAK_REST_BASE, MelipayamakClient, parseMelipayamakResponse } from './melipayamak.client';
import { SmsSettingsService } from './sms-settings.service';

const configOf = (values: Record<string, string>) =>
  ({ get: (key: string, fallback?: string) => values[key] ?? fallback }) as unknown as ConfigService;

function settingsService(env: Record<string, string> = {}) {
  let row: { value: unknown } | null = null;
  const prisma = {
    appSetting: {
      findUnique: jest.fn(async () => row),
      upsert: jest.fn(async ({ create, update }: { create: { value: unknown }; update: { value: unknown } }) => {
        row = { value: row ? update.value : create.value };
        return row;
      }),
    },
  };
  const audit = { record: jest.fn() };
  const service = new SmsSettingsService(prisma as any, configOf({ JWT_SECRET: 'a-sufficiently-long-jwt-secret', ...env }), audit as any);
  return { service, prisma, audit, stored: () => row?.value as any };
}

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, text: async () => JSON.stringify(body) }) as Response;

describe('SecretBox', () => {
  it('round-trips and refuses another key or tampered data', () => {
    const box = new SecretBox('first-key-0123456789');
    const sealed = box.encrypt('api-key-123');
    expect(sealed).not.toContain('api-key-123');
    expect(box.decrypt(sealed)).toBe('api-key-123');
    expect(new SecretBox('second-key-0123456789').decrypt(sealed)).toBeNull();
    expect(box.decrypt(`${sealed.slice(0, -4)}AAAA`)).toBeNull();
  });
});

describe('Melipayamak REST responses', () => {
  it('treats a long recId as success and maps error codes to Persian messages', () => {
    expect(parseMelipayamakResponse({ Value: '2161234567890123456', RetStatus: 1, StrRetStatus: 'Ok' })).toMatchObject({ ok: true, recId: '2161234567890123456' });
    expect(parseMelipayamakResponse({ Value: '0', RetStatus: 0 })).toMatchObject({ ok: false, code: '0' });
    expect(parseMelipayamakResponse({ Value: '2', RetStatus: 1 }).message).toContain('اعتبار');
    expect(parseMelipayamakResponse({ Value: '-4', RetStatus: 1 }, true).message).toContain('پترن');
    expect(parseMelipayamakResponse(null)).toMatchObject({ ok: false });
  });

  it('posts form-encoded credentials and pattern variables joined by ;', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ Value: '9876543210123456', RetStatus: 1 }));
    const client = new MelipayamakClient({ username: 'u', password: 'k' }, fetchImpl as unknown as typeof fetch);
    await expect(client.sendPattern('09120000000', '12345', ['1234', 'a;b'])).resolves.toMatchObject({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${MELIPAYAMAK_REST_BASE}/BaseServiceNumber`);
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toEqual({ username: 'u', password: 'k', to: '09120000000', bodyId: '12345', text: '1234;a,b' });
  });
});

describe('SmsSettingsService', () => {
  it('defaults to Melipayamak and falls back to .env values', async () => {
    const { service } = settingsService({ MELIPAYAMAK_USERNAME: 'envuser', MELIPAYAMAK_PASSWORD: 'envkey', MELIPAYAMAK_SENDER: '5000123' });
    const view = await service.view();
    expect(view).toMatchObject({ provider: 'melipayamak', providerSource: 'default', configured: true });
    expect(view.melipayamak).toMatchObject({ username: 'envuser', sender: '5000123', hasPassword: true, passwordSource: 'env' });
    expect(JSON.stringify(view)).not.toContain('envkey');
  });

  it('stores the API key encrypted, never returns it, and keeps it when the field is left empty', async () => {
    const { service, stored, audit } = settingsService();
    await service.update('admin', { provider: 'melipayamak', melipayamakUsername: 'u1', melipayamakPassword: 'secret-key', melipayamakSender: '30001', melipayamakOtpBodyId: '111' });
    expect(JSON.stringify(stored())).not.toContain('secret-key');
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('secret-key');
    expect((await service.effective()).melipayamak.password).toBe('secret-key');

    const view = await service.update('admin', { provider: 'melipayamak', melipayamakPassword: null, melipayamakSender: '30002' });
    expect(view.melipayamak).toMatchObject({ username: 'u1', sender: '30002', otpBodyId: '111', hasPassword: true, passwordSource: 'database' });
    expect(JSON.stringify(view)).not.toContain('secret-key');

    await service.update('admin', { provider: 'melipayamak', clearMelipayamakPassword: true });
    expect((await service.view()).melipayamak.hasPassword).toBe(false);
  });

  it('flags a stored key that the current encryption key cannot open', async () => {
    const first = settingsService();
    await first.service.update('admin', { provider: 'melipayamak', melipayamakUsername: 'u', melipayamakPassword: 'k1', melipayamakSender: '3000' });
    const second = new SmsSettingsService(
      { appSetting: { findUnique: async () => ({ value: first.stored() }) } } as any,
      configOf({ SETTINGS_ENCRYPTION_KEY: 'another-encryption-key-123' }),
      { record: jest.fn() } as any,
    );
    expect((await second.view()).melipayamak).toMatchObject({ hasPassword: false, passwordUnreadable: true });
  });

  it('refuses mock mode in production', async () => {
    const { service } = settingsService({ NODE_ENV: 'production' });
    await expect(service.update('admin', { provider: 'mock' })).rejects.toThrow();
  });
});

describe('SmsGateway with Melipayamak', () => {
  async function gateway(env: Record<string, string>, update: Parameters<SmsSettingsService['update']>[1] | null) {
    const { service } = settingsService(env);
    if (update) await service.update('admin', update);
    const sms = new SmsGateway(configOf(env), service);
    const fetchImpl = jest.fn(async () => jsonResponse({ Value: '1234567890123456', RetStatus: 1 }));
    sms.fetchImpl = fetchImpl as unknown as typeof fetch;
    return { sms, fetchImpl };
  }
  const configured = { provider: 'melipayamak' as const, melipayamakUsername: 'u', melipayamakPassword: 'k', melipayamakSender: '30001' };

  it('sends OTP through the approved pattern when a bodyId is set', async () => {
    const { sms, fetchImpl } = await gateway({}, { ...configured, melipayamakOtpBodyId: '4321' });
    await sms.sendOtp('09121234567', '654321');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/BaseServiceNumber$/);
    expect(new URLSearchParams(String(init.body)).get('text')).toBe('654321');
  });

  it('sends plain text from the sender line and surfaces provider errors', async () => {
    const { sms, fetchImpl } = await gateway({}, configured);
    await sms.sendText('09121234567', 'سلام');
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toMatch(/SendSMS$/);
    fetchImpl.mockResolvedValueOnce(jsonResponse({ Value: '2', RetStatus: 1 }));
    await expect(sms.sendText('09121234567', 'سلام')).rejects.toThrow(/اعتبار/);
  });

  it('only logs when unconfigured outside production, and fails loudly in production', async () => {
    const dev = await gateway({}, null);
    await expect(dev.sms.sendOtp('09121234567', '111111')).resolves.toBeUndefined();
    expect(dev.fetchImpl).not.toHaveBeenCalled();

    const prod = await gateway({ NODE_ENV: 'production' }, null);
    await expect(prod.sms.sendOtp('09121234567', '111111')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('reports test results instead of throwing', async () => {
    const { sms, fetchImpl } = await gateway({}, configured);
    fetchImpl.mockResolvedValueOnce(jsonResponse({ Value: '35', RetStatus: 1 }));
    await expect(sms.test('09121234567', 'text')).resolves.toMatchObject({ ok: false, method: 'text', message: expect.stringContaining('لیست سیاه') });
  });
});
