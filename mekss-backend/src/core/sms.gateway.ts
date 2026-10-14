import { Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MelipayamakClient, MelipayamakResult, MelipayamakTransportError } from './sms/melipayamak.client';
import { EffectiveSmsSettings, SmsSettingsService } from './sms/sms-settings.service';

export interface SmsTestResult {
  ok: boolean;
  provider: string;
  method: 'text' | 'pattern' | 'mock';
  recId: string | null;
  message: string;
}

/**
 * Outbound SMS. The provider and its credentials come from {@link SmsSettingsService} (admin panel,
 * falling back to `.env`); Melipayamak is the default. OTPs go through an approved Melipayamak pattern
 * when one is configured, because shared service lines also reach numbers on the operators'
 * advertising blacklist; everything else is sent as plain text from the dedicated sender line.
 */
@Injectable()
export class SmsGateway {
  private readonly logger = new Logger(SmsGateway.name);
  /** Replaceable in tests. */
  fetchImpl: typeof fetch = (input, init) => fetch(input, init);

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly settings?: SmsSettingsService,
  ) {}

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const settings = await this.resolve();
    if (settings.provider === 'mock' || this.devFallback(settings)) {
      this.logger.log(`Mock OTP generated for ${this.mask(phoneNumber)}.`);
      if (this.config.get<string>('NODE_ENV') !== 'production') this.logger.debug(`Mock OTP code: ${code}`);
      return;
    }
    if (settings.provider === 'kavenegar') return this.kavenegarOtp(phoneNumber, code);

    const result = await this.melipayamakOtp(settings, phoneNumber, code);
    if (!result.ok) {
      this.logger.error(`Melipayamak rejected OTP delivery to ${this.mask(phoneNumber)}: ${result.code} ${result.message}`);
      throw new ServiceUnavailableException(`ارسال کد تایید ناموفق بود: ${result.message}`);
    }
  }

  async sendText(phoneNumber: string, message: string): Promise<void> {
    const settings = await this.resolve();
    if (settings.provider === 'mock' || this.devFallback(settings)) {
      this.logger.log(`Mock SMS to ${this.mask(phoneNumber)} (${message.length} chars).`);
      if (this.config.get<string>('NODE_ENV') !== 'production') this.logger.debug(`Mock SMS text: ${message}`);
      return;
    }
    if (settings.provider === 'kavenegar') return this.kavenegarText(phoneNumber, message);

    const result = await this.melipayamakText(settings, phoneNumber, message);
    if (!result.ok) {
      this.logger.error(`Melipayamak rejected SMS delivery to ${this.mask(phoneNumber)}: ${result.code} ${result.message}`);
      throw new ServiceUnavailableException(`ارسال پیامک ناموفق بود: ${result.message}`);
    }
  }

  /** Admin "send test" button: reports the provider's answer instead of throwing. */
  async test(phoneNumber: string, kind: 'text' | 'otp'): Promise<SmsTestResult> {
    const settings = await this.resolve();
    const provider = settings.provider;
    if (provider === 'mock') {
      return { ok: true, provider, method: 'mock', recId: null, message: 'حالت آزمایشی فعال است؛ پیامکی واقعاً ارسال نمی‌شود' };
    }
    if (!this.settings?.isConfigured(settings)) {
      return { ok: false, provider, method: 'text', recId: null, message: 'تنظیمات سامانه پیامک کامل نیست' };
    }
    if (provider === 'kavenegar') {
      try {
        if (kind === 'otp') await this.kavenegarOtp(phoneNumber, '123456');
        else await this.kavenegarText(phoneNumber, 'پیام آزمایشی سامانه MEKSS');
        return { ok: true, provider, method: 'text', recId: null, message: 'ارسال شد' };
      } catch (error) {
        return { ok: false, provider, method: 'text', recId: null, message: error instanceof Error ? error.message : 'ارسال ناموفق' };
      }
    }
    const usePattern = kind === 'otp' && Boolean(settings.melipayamak.otpBodyId);
    const result = kind === 'otp'
      ? await this.melipayamakOtp(settings, phoneNumber, String(100000 + Math.floor(Math.random() * 900000)))
      : await this.melipayamakText(settings, phoneNumber, 'پیام آزمایشی سامانه MEKSS');
    return { ok: result.ok, provider, method: usePattern ? 'pattern' : 'text', recId: result.recId, message: result.message };
  }

  async credit(): Promise<{ provider: string; ok: boolean; credit: number | null; message: string }> {
    const settings = await this.resolve();
    if (settings.provider !== 'melipayamak') {
      return { provider: settings.provider, ok: false, credit: null, message: 'استعلام اعتبار فقط برای ملی پیامک پشتیبانی می‌شود' };
    }
    const m = settings.melipayamak;
    if (!m.username || !m.password) return { provider: 'melipayamak', ok: false, credit: null, message: 'نام کاربری یا کلید API ملی پیامک ثبت نشده است' };
    try {
      return { provider: 'melipayamak', ...(await this.client(settings).credit()) };
    } catch (error) {
      return { provider: 'melipayamak', ok: false, credit: null, message: error instanceof Error ? error.message : 'خطای ارتباط' };
    }
  }

  private async resolve(): Promise<EffectiveSmsSettings> {
    if (this.settings) return this.settings.effective();
    const provider = this.config.get<string>('SMS_PROVIDER', 'mock').toLowerCase();
    return {
      provider: provider === 'kavenegar' || provider === 'melipayamak' ? provider : 'mock',
      providerSource: 'env',
      melipayamak: { username: '', password: '', sender: '', otpBodyId: '', passwordSource: null, passwordUnreadable: false },
      kavenegarConfigured: Boolean(this.config.get<string>('KAVEH_NEGAR_API_KEY')),
    };
  }

  /**
   * Melipayamak is the default provider, so an unconfigured development install must keep working:
   * outside production a missing configuration behaves like mock. In production it fails loudly.
   */
  private devFallback(settings: EffectiveSmsSettings): boolean {
    if (settings.provider !== 'melipayamak' || this.settings?.isConfigured(settings)) return false;
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException('سامانه پیامک (ملی پیامک) هنوز در پنل مدیریت تنظیم نشده است');
    }
    this.logger.warn('Melipayamak is not configured; SMS is only logged (set it up in the admin panel).');
    return true;
  }

  private client(settings: EffectiveSmsSettings) {
    return new MelipayamakClient({ username: settings.melipayamak.username, password: settings.melipayamak.password }, this.fetchImpl);
  }

  private async melipayamakOtp(settings: EffectiveSmsSettings, phoneNumber: string, code: string): Promise<MelipayamakResult> {
    const { otpBodyId } = settings.melipayamak;
    if (otpBodyId) return this.guard(() => this.client(settings).sendPattern(phoneNumber, otpBodyId, [code]));
    return this.melipayamakText(settings, phoneNumber, `کد تایید MEKSS: ${code}`);
  }

  private async melipayamakText(settings: EffectiveSmsSettings, phoneNumber: string, message: string): Promise<MelipayamakResult> {
    const { sender } = settings.melipayamak;
    if (!sender) return { ok: false, recId: null, code: null, message: 'شماره فرستنده ملی پیامک ثبت نشده است' };
    return this.guard(() => this.client(settings).sendText(phoneNumber, sender, message));
  }

  private async guard(send: () => Promise<MelipayamakResult>): Promise<MelipayamakResult> {
    try {
      return await send();
    } catch (error) {
      if (error instanceof MelipayamakTransportError) return { ok: false, recId: null, code: null, message: error.message };
      throw error;
    }
  }

  private async kavenegarOtp(phoneNumber: string, code: string): Promise<void> {
    const apiKey = this.config.get<string>('KAVEH_NEGAR_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('Kavenegar is not configured');

    const template = this.config.get<string>('KAVEH_NEGAR_TEMPLATE');
    const endpoint = template
      ? `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`
      : `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`;
    const payload = template
      ? { receptor: phoneNumber, token: code, template }
      : { receptor: phoneNumber, message: `کد تایید MEKSS: ${code}`, sender: this.config.get<string>('SMS_SENDER') };

    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.entries(payload).filter(([, value]) => Boolean(value)) as [string, string][]),
    });
    if (!response.ok) {
      this.logger.error(`Kavenegar rejected OTP delivery to ${this.mask(phoneNumber)} with ${response.status}.`);
      throw new ServiceUnavailableException('OTP delivery failed');
    }
  }

  private async kavenegarText(phoneNumber: string, message: string): Promise<void> {
    const apiKey = this.config.get<string>('KAVEH_NEGAR_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('Kavenegar is not configured');

    const endpoint = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`;
    const payload = {
      receptor: phoneNumber,
      message,
      sender: this.config.get<string>('SMS_SENDER'),
    };

    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.entries(payload).filter(([, value]) => Boolean(value)) as [string, string][]),
    });
    if (!response.ok) {
      this.logger.error(`Kavenegar rejected SMS delivery to ${this.mask(phoneNumber)} with ${response.status}.`);
      throw new ServiceUnavailableException('SMS delivery failed');
    }
  }

  private mask(phoneNumber: string): string {
    return phoneNumber.length < 5 ? '***' : `${phoneNumber.slice(0, 4)}***${phoneNumber.slice(-2)}`;
  }
}
