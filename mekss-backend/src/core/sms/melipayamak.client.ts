/**
 * Melipayamak (ملی پیامک) REST web service: https://www.melipayamak.com/api/
 * Every endpoint takes form-encoded `username` + `password` (the panel password or, preferably, the
 * console API key) and answers `{ Value, RetStatus, StrRetStatus }`. A successful send returns the
 * delivery id (recId, a long number) in `Value`; failures return a small error code either in
 * `RetStatus` or in `Value`.
 */
export const MELIPAYAMAK_REST_BASE = 'https://rest.payamak-panel.com/api/SendSMS';

export interface MelipayamakCredentials {
  username: string;
  password: string;
}

export interface MelipayamakResult {
  ok: boolean;
  recId: string | null;
  code: string | null;
  message: string;
}

/** Codes shared by SendSMS (SendSimpleSMS2), SendOtp and the pattern methods (SendByBaseNumber*). */
const COMMON_ERRORS: Record<string, string> = {
  '0': 'نام کاربری یا رمز عبور/کلید API ملی پیامک صحیح نیست',
  '2': 'اعتبار پنل ملی پیامک کافی نیست',
  '3': 'محدودیت ارسال روزانه پنل ملی پیامک',
  '4': 'محدودیت حجم ارسال پنل ملی پیامک',
  '5': 'شماره فرستنده معتبر نیست',
  '6': 'سامانه ملی پیامک در حال به‌روزرسانی است؛ کمی بعد دوباره تلاش کنید',
  '7': 'متن پیامک حاوی کلمه فیلترشده است',
  '9': 'ارسال از خطوط عمومی از طریق وب‌سرویس ممکن نیست',
  '10': 'کاربر پنل ملی پیامک فعال نیست',
  '11': 'پیامک ارسال نشد',
  '12': 'مدارک کاربر پنل ملی پیامک کامل نیست',
  '14': 'متن پیامک حاوی لینک است',
  '15': 'ارسال به بیش از یک شماره بدون «لغو11» ممکن نیست',
  '16': 'شماره گیرنده یافت نشد',
  '17': 'متن پیامک خالی است',
  '18': 'شماره گیرنده نامعتبر است',
  '19': 'از محدودیت ساعتی ارسال فراتر رفته‌اید',
  '35': 'شماره گیرنده در لیست سیاه مخابرات است؛ برای این شماره از ارسال با پترن (خط خدماتی) استفاده کنید',
  '-108': 'IP سرور به دلیل تلاش‌های ناموفق در ملی پیامک مسدود شده است',
  '-109': 'در پنل ملی پیامک باید IP مجاز برای استفاده از API تنظیم شود',
  '-110': 'ملی پیامک استفاده از کلید API به‌جای رمز عبور را الزامی کرده است',
  '-111': 'IP سرور برای ملی پیامک معتبر نیست؛ IP سرور را در پنل ملی پیامک مجاز کنید',
};

const PATTERN_ERRORS: Record<string, string> = {
  '-1': 'دسترسی به وب‌سرویس پترن در پنل ملی پیامک غیرفعال است',
  '-2': 'در هر ارسال پترن فقط یک شماره مجاز است',
  '-3': 'خط خدماتی در پنل ملی پیامک تعریف نشده است',
  '-4': 'کد پترن (bodyId) صحیح نیست یا هنوز تأیید نشده است',
  '-5': 'متغیرهای ارسالی با متن پترن همخوانی ندارد',
  '-6': 'خطای داخلی ملی پیامک',
  '-7': 'خطا در شماره فرستنده خط خدماتی',
  '-10': 'متغیرهای پترن نباید لینک داشته باشند',
};

export function describeMelipayamakCode(code: string, pattern = false): string {
  return (pattern ? PATTERN_ERRORS[code] : undefined) ?? COMMON_ERRORS[code] ?? `خطای ملی پیامک (کد ${code})`;
}

export function parseMelipayamakResponse(body: unknown, pattern = false): MelipayamakResult {
  const record = (body && typeof body === 'object' ? body : {}) as { Value?: unknown; RetStatus?: unknown; StrRetStatus?: unknown };
  const value = record.Value === undefined || record.Value === null ? '' : String(record.Value).trim();
  const status = Number(record.RetStatus);
  // Error codes are at most three digits (or negative); a recId is a long number.
  if (status === 1 && /^\d{5,}$/.test(value)) return { ok: true, recId: value, code: null, message: 'ارسال شد' };
  const code = status !== 1 && Number.isFinite(status) ? String(status) : value || String(record.RetStatus ?? '');
  return { ok: false, recId: null, code: code || null, message: code ? describeMelipayamakCode(code, pattern) : 'پاسخ نامعتبر از ملی پیامک' };
}

export class MelipayamakClient {
  constructor(
    private readonly credentials: MelipayamakCredentials,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  /** SendSimpleSMS2 equivalent: free text from a dedicated sender line. */
  sendText(to: string, from: string, text: string): Promise<MelipayamakResult> {
    return this.call('SendSMS', { to, from, text, isFlash: 'false' }, false);
  }

  /**
   * SendByBaseNumber2 equivalent (shared service line, approved pattern): reaches numbers on the
   * operators' advertising blacklist, which plain sends cannot. Variables are joined with `;`.
   */
  sendPattern(to: string, bodyId: string, args: string[]): Promise<MelipayamakResult> {
    return this.call('BaseServiceNumber', { to, bodyId, text: args.map((a) => a.replace(/;/g, ',')).join(';') }, true);
  }

  async credit(): Promise<{ ok: boolean; credit: number | null; message: string }> {
    const body = await this.request('GetCredit', {});
    const record = (body && typeof body === 'object' ? body : {}) as { Value?: unknown; RetStatus?: unknown };
    const credit = Number(record.Value);
    if (Number(record.RetStatus) === 1 && Number.isFinite(credit)) return { ok: true, credit, message: 'ok' };
    const code = String(record.RetStatus ?? record.Value ?? '');
    return { ok: false, credit: null, message: describeMelipayamakCode(code) };
  }

  private async call(method: string, params: Record<string, string>, pattern: boolean): Promise<MelipayamakResult> {
    return parseMelipayamakResponse(await this.request(method, params), pattern);
  }

  private async request(method: string, params: Record<string, string>): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${MELIPAYAMAK_REST_BASE}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({ username: this.credentials.username, password: this.credentials.password, ...params }),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) throw new MelipayamakTransportError(`HTTP ${response.status}`);
      try {
        return JSON.parse(text);
      } catch {
        throw new MelipayamakTransportError('non-JSON response');
      }
    } catch (error) {
      if (error instanceof MelipayamakTransportError) throw error;
      const aborted = (error as Error)?.name === 'AbortError';
      throw new MelipayamakTransportError(aborted ? 'timeout' : (error as Error)?.message || 'network error');
    } finally {
      clearTimeout(timer);
    }
  }
}

export class MelipayamakTransportError extends Error {
  constructor(reason: string) {
    super(`ارتباط با ملی پیامک برقرار نشد (${reason})`);
    this.name = 'MelipayamakTransportError';
  }
}
