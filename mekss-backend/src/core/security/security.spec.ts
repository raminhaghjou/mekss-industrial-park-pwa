import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash } from 'crypto';
import { CaptchaService, renderCaptchaSvg } from './captcha.service';
import { EphemeralStore } from './ephemeral-store';
import { RateLimitService, clientIp } from './rate-limit.service';

const config = (values: Record<string, string> = {}) => new ConfigService(values);

/** Mints a token the way the service does, so tests can know the answer. */
function forge(secret: string, answer: string, expiresAt = Date.now() + 60_000, nonce = 'AAAAAAAAAAAAAAAAAAAAAA') {
  const key = createHash('sha256').update(`mekss-captcha:${secret}`).digest();
  const mac = createHmac('sha256', key).update(`${nonce}.${expiresAt}.${answer}`).digest('base64url');
  return `v1.${nonce}.${expiresAt}.${mac}`;
}

describe('renderCaptchaSvg', () => {
  it('draws glyphs as paths and never leaks the answer as text', () => {
    const svg = renderCaptchaSvg('83472');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toMatch(/<text/i);
    expect(svg).not.toContain('83472');
    expect((svg.match(/<path/g) || []).length).toBeGreaterThanOrEqual(5);
  });
});

describe('CaptchaService', () => {
  const secret = 'unit-test-secret';
  let store: EphemeralStore;
  let captcha: CaptchaService;

  beforeEach(() => {
    store = new EphemeralStore(config());
    captcha = new CaptchaService(config({ CAPTCHA_SECRET: secret }), store);
  });

  it('issues a PNG challenge with a signed one-time token', async () => {
    const challenge = await captcha.issue();
    expect(challenge.image.startsWith('data:image/png;base64,')).toBe(true);
    expect(Buffer.from(challenge.image.split(',')[1], 'base64').subarray(1, 4).toString()).toBe('PNG');
    expect(challenge.captchaId.split('.')).toHaveLength(4);
    expect(challenge.expiresIn).toBeGreaterThan(0);
  });

  it('accepts the right answer once, including Persian digits', async () => {
    const token = forge(secret, '23456');
    await expect(captcha.verify(token, '۲۳۴۵۶')).resolves.toBeUndefined();
    await expect(captcha.verify(token, '23456')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('burns the challenge on a wrong guess', async () => {
    const token = forge(secret, '23456');
    await expect(captcha.verify(token, '99999')).rejects.toBeInstanceOf(BadRequestException);
    await expect(captcha.verify(token, '23456')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects expired, malformed and foreign-key tokens', async () => {
    await expect(captcha.verify(forge(secret, '23456', Date.now() - 1), '23456')).rejects.toBeInstanceOf(BadRequestException);
    await expect(captcha.verify('garbage', '23456')).rejects.toBeInstanceOf(BadRequestException);
    await expect(captcha.verify(undefined, undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(captcha.verify(forge('other-secret', '23456'), '23456')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a token whose expiry was tampered with', async () => {
    const [v, nonce, , mac] = forge(secret, '23456').split('.');
    await expect(captcha.verify(`${v}.${nonce}.${Date.now() + 3_600_000}.${mac}`, '23456')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('EphemeralStore (memory fallback)', () => {
  it('counts within a window and resets after it', async () => {
    const store = new EphemeralStore(config());
    expect(await store.increment('k', 50)).toBe(1);
    expect(await store.increment('k', 50)).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(await store.increment('k', 50)).toBe(1);
  });

  it('claims a key only once until it expires', async () => {
    const store = new EphemeralStore(config());
    expect(await store.claimOnce('n', 50)).toBe(true);
    expect(await store.claimOnce('n', 50)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(await store.claimOnce('n', 50)).toBe(true);
  });
});

describe('RateLimitService', () => {
  it('throws 429 once a key exceeds its rule and keeps keys independent', async () => {
    const limiter = new RateLimitService(new EphemeralStore(config()));
    const rule = { limit: 2, windowMs: 60_000 };
    await limiter.consume('t', [{ key: 'a', rule }]);
    await limiter.consume('t', [{ key: 'a', rule }]);
    const error = await limiter.consume('t', [{ key: 'a', rule }]).catch((caught) => caught);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    await expect(limiter.consume('t', [{ key: 'b', rule }])).resolves.toBeUndefined();
    await expect(limiter.consume('other', [{ key: 'a', rule }])).resolves.toBeUndefined();
  });

  it('skips empty keys', async () => {
    const limiter = new RateLimitService(new EphemeralStore(config()));
    const rule = { limit: 0, windowMs: 60_000 };
    await expect(limiter.consume('t', [{ key: undefined, rule }, { key: '', rule }])).resolves.toBeUndefined();
  });

  it('reads the client address from the request', () => {
    expect(clientIp({ ip: '10.0.0.5' })).toBe('10.0.0.5');
    expect(clientIp({ socket: { remoteAddress: '::1' } })).toBe('::1');
    expect(clientIp({})).toBe('unknown');
  });
});
