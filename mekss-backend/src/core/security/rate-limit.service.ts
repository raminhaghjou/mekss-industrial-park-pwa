import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EphemeralStore } from './ephemeral-store';

export type RateRule = { limit: number; windowMs: number };

/** Fixed-window limits for unauthenticated or SMS-sending endpoints. */
export const RATE_RULES = {
  captchaPerIp: { limit: 30, windowMs: 10 * 60_000 },
  publicSmsPerIp: { limit: 10, windowMs: 10 * 60_000 },
  publicSmsPerPhone: { limit: 3, windowMs: 10 * 60_000 },
  // Per-IP limits stay generous: a whole factory or gatehouse often shares one NAT address.
  otpPerIp: { limit: 20, windowMs: 10 * 60_000 },
  otpPerPhone: { limit: 3, windowMs: 10 * 60_000 },
  otpVerifyPerIp: { limit: 30, windowMs: 10 * 60_000 },
  loginPerIp: { limit: 60, windowMs: 10 * 60_000 },
} satisfies Record<string, RateRule>;

@Injectable()
export class RateLimitService {
  constructor(private readonly store: EphemeralStore) {}

  /** Counts one hit for every key and rejects with 429 once any of them exceeds its rule. */
  async consume(scope: string, checks: Array<{ key: string | undefined | null; rule: RateRule }>): Promise<void> {
    for (const { key, rule } of checks) {
      if (!key) continue;
      const count = await this.store.increment(`rl:${scope}:${key}`, rule.windowMs);
      if (count > rule.limit) {
        const minutes = Math.ceil(rule.windowMs / 60_000);
        throw new HttpException(
          `تعداد درخواست‌ها بیش از حد مجاز است؛ لطفاً ${minutes} دقیقه دیگر دوباره تلاش کنید.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }
}

/** Client address as seen through the trusted proxy chain (see TRUST_PROXY in main.ts). */
export const clientIp = (request: { ip?: string; socket?: { remoteAddress?: string } }): string =>
  request.ip || request.socket?.remoteAddress || 'unknown';
