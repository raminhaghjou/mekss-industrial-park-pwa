import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit.service';
import { PrismaService } from '../prisma.service';
import { SecretBox } from '../secret-box';

export const SMS_PROVIDERS = ['melipayamak', 'kavenegar', 'mock'] as const;
export type SmsProvider = (typeof SMS_PROVIDERS)[number];

const SETTINGS_KEY = 'sms_settings';
const CACHE_MS = 30_000;

interface StoredSmsSettings {
  provider?: SmsProvider;
  melipayamak?: {
    username?: string | null;
    passwordSealed?: string | null;
    sender?: string | null;
    otpBodyId?: string | null;
  };
}

export interface EffectiveSmsSettings {
  provider: SmsProvider;
  providerSource: 'database' | 'env' | 'default';
  melipayamak: {
    username: string;
    password: string;
    sender: string;
    otpBodyId: string;
    passwordSource: 'database' | 'env' | null;
    /** A password is stored but cannot be decrypted (encryption key changed). */
    passwordUnreadable: boolean;
  };
  kavenegarConfigured: boolean;
}

export interface SmsSettingsUpdate {
  provider: SmsProvider;
  melipayamakUsername?: string | null;
  /** Omitted/empty keeps the stored secret. */
  melipayamakPassword?: string | null;
  clearMelipayamakPassword?: boolean;
  melipayamakSender?: string | null;
  melipayamakOtpBodyId?: string | null;
}

/**
 * SMS gateway settings: edited by the super admin in the panel and stored in AppSetting, with the
 * Melipayamak password/API key sealed by {@link SecretBox}. Any field left empty in the panel falls
 * back to the environment (MELIPAYAMAK_*, SMS_PROVIDER), so an `.env`-only deployment keeps working.
 * Secrets never leave the server: the admin view only says whether one is set.
 */
@Injectable()
export class SmsSettingsService {
  private readonly logger = new Logger(SmsSettingsService.name);
  private readonly box: SecretBox;
  readonly keySource: 'SETTINGS_ENCRYPTION_KEY' | 'JWT_SECRET' | 'development';
  private cache: { at: number; value: EffectiveSmsSettings } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    const dedicated = (config.get<string>('SETTINGS_ENCRYPTION_KEY') || '').trim();
    const jwt = (config.get<string>('JWT_ACCESS_SECRET') || config.get<string>('JWT_SECRET') || '').trim();
    if (dedicated.length >= 16) {
      this.keySource = 'SETTINGS_ENCRYPTION_KEY';
      this.box = new SecretBox(dedicated);
    } else if (jwt.length >= 16) {
      this.keySource = 'JWT_SECRET';
      this.box = new SecretBox(jwt);
    } else {
      this.keySource = 'development';
      this.box = new SecretBox('development-only-settings-key');
    }
  }

  async effective(): Promise<EffectiveSmsSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const value = this.merge(await this.stored());
    this.cache = { at: Date.now(), value };
    return value;
  }

  /** Admin view: no secrets. */
  async view() {
    const settings = await this.effective();
    const m = settings.melipayamak;
    return {
      provider: settings.provider,
      providerSource: settings.providerSource,
      configured: this.isConfigured(settings),
      melipayamak: {
        username: m.username,
        sender: m.sender,
        otpBodyId: m.otpBodyId,
        hasPassword: Boolean(m.password),
        passwordSource: m.passwordSource,
        passwordUnreadable: m.passwordUnreadable,
      },
      kavenegar: { configured: settings.kavenegarConfigured },
      encryptionKeySource: this.keySource,
    };
  }

  async health() {
    const settings = await this.effective();
    const sender = settings.provider === 'kavenegar'
      ? (this.config.get<string>('SMS_SENDER') || '').trim()
      : settings.provider === 'melipayamak' ? settings.melipayamak.sender : '';
    return {
      provider: settings.provider,
      configured: this.isConfigured(settings),
      maskedSender: sender ? `${sender.slice(0, 4)}***${sender.slice(-2)}` : null,
    };
  }

  isConfigured(settings: EffectiveSmsSettings): boolean {
    if (settings.provider === 'mock') return true;
    if (settings.provider === 'kavenegar') return settings.kavenegarConfigured;
    const m = settings.melipayamak;
    return Boolean(m.username && m.password && (m.sender || m.otpBodyId));
  }

  async update(actorId: string, input: SmsSettingsUpdate) {
    if (!SMS_PROVIDERS.includes(input.provider)) throw new BadRequestException('Unsupported SMS provider');
    if (input.provider === 'mock' && this.config.get<string>('NODE_ENV') === 'production') {
      throw new BadRequestException('حالت آزمایشی (بدون ارسال واقعی) در محیط production مجاز نیست');
    }
    const current = await this.stored();
    const prev = current.melipayamak || {};
    const clean = (value: string | null | undefined, previous: string | null | undefined) =>
      value === undefined ? (previous ?? null) : (value?.trim() || null);
    const password = input.melipayamakPassword?.trim();
    const passwordSealed = input.clearMelipayamakPassword
      ? null
      : password ? this.box.encrypt(password) : (prev.passwordSealed ?? null);
    const next: StoredSmsSettings = {
      provider: input.provider,
      melipayamak: {
        username: clean(input.melipayamakUsername, prev.username),
        passwordSealed,
        sender: clean(input.melipayamakSender, prev.sender),
        otpBodyId: clean(input.melipayamakOtpBodyId, prev.otpBodyId),
      },
    };
    const value = next as unknown as Prisma.InputJsonValue;
    await this.prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value, updatedById: actorId },
      update: { value, updatedById: actorId },
    });
    this.cache = null;
    await this.audit.record({
      userId: actorId,
      action: 'SMS_SETTINGS_UPDATED',
      entity: 'AppSetting',
      entityId: SETTINGS_KEY,
      changes: {
        provider: input.provider,
        username: next.melipayamak?.username ?? null,
        sender: next.melipayamak?.sender ?? null,
        otpBodyId: next.melipayamak?.otpBodyId ?? null,
        apiKeyChanged: Boolean(password) || Boolean(input.clearMelipayamakPassword),
      },
    });
    return this.view();
  }

  private async stored(): Promise<StoredSmsSettings> {
    try {
      const row = await this.prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
      const value = row?.value;
      return value && typeof value === 'object' && !Array.isArray(value) ? (value as StoredSmsSettings) : {};
    } catch (error) {
      this.logger.warn(`SMS settings unavailable, using environment: ${error instanceof Error ? error.message : error}`);
      return {};
    }
  }

  private merge(stored: StoredSmsSettings): EffectiveSmsSettings {
    const env = (key: string) => (this.config.get<string>(key) || '').trim();
    const envProvider = env('SMS_PROVIDER').toLowerCase();
    const provider: SmsProvider = stored.provider && SMS_PROVIDERS.includes(stored.provider)
      ? stored.provider
      : (SMS_PROVIDERS as readonly string[]).includes(envProvider) ? (envProvider as SmsProvider) : 'melipayamak';
    const providerSource = stored.provider ? 'database' : envProvider ? 'env' : 'default';

    const m = stored.melipayamak || {};
    let password = '';
    let passwordSource: 'database' | 'env' | null = null;
    let passwordUnreadable = false;
    if (m.passwordSealed) {
      const opened = this.box.decrypt(m.passwordSealed);
      if (opened) {
        password = opened;
        passwordSource = 'database';
      } else {
        passwordUnreadable = true;
        this.logger.warn('Stored Melipayamak API key cannot be decrypted (encryption key changed?); re-enter it in the admin panel.');
      }
    }
    if (!password && env('MELIPAYAMAK_PASSWORD')) {
      password = env('MELIPAYAMAK_PASSWORD');
      passwordSource = 'env';
    }
    return {
      provider,
      providerSource,
      melipayamak: {
        username: m.username || env('MELIPAYAMAK_USERNAME'),
        password,
        sender: m.sender || env('MELIPAYAMAK_SENDER'),
        otpBodyId: m.otpBodyId || env('MELIPAYAMAK_OTP_BODY_ID'),
        passwordSource,
        passwordUnreadable,
      },
      kavenegarConfigured: Boolean(env('KAVEH_NEGAR_API_KEY')),
    };
  }
}
