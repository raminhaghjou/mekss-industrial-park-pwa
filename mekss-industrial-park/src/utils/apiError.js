const normalizeServerMessage = (message) => (typeof message === 'string' && message.trim() ? message : null);

/**
 * Known English (and a few Persian) API messages mapped to clear Persian UI copy.
 * Matching is case-insensitive and ignores trailing punctuation.
 */
const SERVER_MESSAGE_FA = {
  'a user with this phone number already exists':
    'کاربری با این شماره تلفن قبلاً ثبت‌نام کرده است. لطفاً وارد شوید یا بازیابی رمز عبور را امتحان کنید.',
  'user with this phone number already exists':
    'کاربری با این شماره تلفن قبلاً ثبت‌نام کرده است. لطفاً وارد شوید یا بازیابی رمز عبور را امتحان کنید.',
  'account is awaiting approval':
    'کاربری شما تایید نگردیده است',
  'account not approved yet':
    'کاربری شما تایید نگردیده است',
  'کاربری شما تایید نگردیده است':
    'کاربری شما تایید نگردیده است',
  'account is disabled':
    'حساب کاربری شما غیرفعال شده است. با پشتیبانی سامانه تماس بگیرید.',
  'invalid credentials':
    'نام کاربری/شماره تلفن یا رمز عبور نادرست است.',
  'phonenumber or username is required':
    'نام کاربری یا شماره تلفن را وارد کنید.',
  'provide either phonenumber or username, not both':
    'فقط یکی از نام کاربری یا شماره تلفن را وارد کنید.',
  'temporary password sent via sms':
    'رمز موقت همراه با نام کاربری برای شما پیامک شد.',
  'otp is invalid or expired':
    'کد یک‌بارمصرف نامعتبر یا منقضی شده است.',
  'invalid otp':
    'کد یک‌بارمصرف نامعتبر است.',
  'too many requests':
    'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.',
  'password must be 10-128 characters and contain letters and numbers':
    'رمز عبور باید حداقل ۱۰ کاراکتر و شامل حروف انگلیسی و عدد باشد.',
  'newpassword must be 10-128 characters and contain letters and numbers':
    'رمز عبور جدید باید حداقل ۱۰ کاراکتر و شامل حروف انگلیسی و عدد باشد.',
  'phone number is already registered':
    'این شماره موبایل قبلاً در سامانه ثبت شده است.',
  'phone number, username, national id or email is already registered':
    'شماره موبایل، نام کاربری، کد ملی یا ایمیل وارد‌شده قبلاً در سامانه ثبت شده است.',
  'parkid is required':
    'شهرک صنعتی را انتخاب کنید.',
  'parkid is required when multiple parks are assigned':
    'چند شهرک به شما واگذار شده است؛ شهرک محل خدمت کارمند را انتخاب کنید.',
  'no managed park assigned':
    'هیچ شهرکی به حساب شما واگذار نشده است.',
  'gate pass has not been approved by the park manager yet':
    'این برگ خروج هنوز توسط مدیر شهرک تایید نشده است.',
  'gate pass is not awaiting park manager review':
    'این برگ خروج دیگر در انتظار تایید مدیر شهرک نیست؛ فهرست به‌روز شد.',
  'gate pass was already decided by someone else':
    'این برگ خروج هم‌زمان توسط فرد دیگری بررسی شد؛ فهرست به‌روز شد.',
  'only the park manager can approve or reject a gate pass':
    'فقط مدیر شهرک می‌تواند برگ خروج را تایید یا رد کند.',
  'only security guards can confirm or deny an exit':
    'فقط نگهبانی می‌تواند خروج را تایید یا رد کند.',
  'gate pass status changed while editing; reload and try again':
    'وضعیت برگ خروج هم‌زمان تغییر کرد (احتمالاً بررسی شد). صفحه را به‌روز و دوباره تلاش کنید.',
  'only pending or rejected gate passes can be edited':
    'فقط برگ خروج در انتظار تایید یا رد‌شده قابل ویرایش است.',
  'a reason is required':
    'ثبت دلیل الزامی است.',
  'a rejection reason is required':
    'ثبت دلیل رد الزامی است.',
};

/** Default class-validator messages (`<field> must ...`) mapped by field. */
const VALIDATION_PATTERNS_FA = [
  [/^phonenumber must match/, 'شماره موبایل معتبر نیست (۱۱ رقم و با ۰۹ شروع شود).'],
  [/^name must be (longer|shorter)/, 'نام و نام خانوادگی باید بین ۲ تا ۱۲۰ کاراکتر باشد.'],
  [/^nationalid must match/, 'کد ملی باید ۱۰ رقم باشد.'],
  [/^username must match/, 'نام کاربری فقط حروف کوچک انگلیسی، عدد و . _ - (۳ تا ۶۴ کاراکتر).'],
  [/^email must be an email/, 'ایمیل معتبر نیست.'],
  [/^amount must not be less than/, 'مبلغ کمتر از حداقل مجاز است.'],
  [/^amount must not be greater than/, 'مبلغ بیشتر از سقف مجاز است.'],
  [/^amount must be a number/, 'مبلغ معتبر نیست.'],
];

const localizeOne = (message) => {
  const normalized = normalizeServerMessage(message);
  if (!normalized) return null;
  const key = normalized.trim().replace(/[.!]+$/g, '').toLowerCase();
  if (SERVER_MESSAGE_FA[key]) return SERVER_MESSAGE_FA[key];
  const pattern = VALIDATION_PATTERNS_FA.find(([regex]) => regex.test(key));
  if (pattern) return pattern[1];
  return normalized;
};

const localizeServerMessage = (message) => {
  if (Array.isArray(message)) {
    const parts = [...new Set(message.map(localizeOne).filter(Boolean))];
    return parts.length ? parts.join('، ') : null;
  }
  return localizeOne(message);
};

/**
 * Persian guidance for the HTTP statuses management pages classify explicitly.
 * Used only as a last-resort fallback when the server did not return a usable
 * message; a specific server message always takes precedence.
 */
const STATUS_FALLBACKS = {
  400: 'اطلاعات ارسال‌شده نامعتبر است. مقادیر را بررسی و دوباره تلاش کنید.',
  401: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.',
  403: 'اجازه انجام این عملیات را ندارید.',
  404: 'مورد درخواستی یافت نشد یا حذف شده است.',
  409: 'این عملیات با وضعیت فعلی داده‌ها در تعارض است. اطلاعات به‌روز دریافت شد؛ دوباره تلاش کنید.',
};

/**
 * Classifies an API/connectivity/timeout failure into one of a small set of
 * Persian-labeled kinds, for callers that need to branch behavior (e.g. force
 * a refetch on 404/409) rather than just display a message.
 * @param {any} error
 * @returns {'offline' | 'timeout' | 'network' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'server' | 'unknown'}
 */
export const classifyApiError = (error) => {
  if (error?.code === 'ERR_CANCELED' || String(error?.message || '').startsWith('Offline:')) return 'offline';
  if (error?.code === 'ECONNABORTED') return 'timeout';
  if (error?.request && !error?.response) return 'network';
  const status = error?.response?.status;
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 400) return 'validation';
  if (typeof status === 'number' && status >= 500) return 'server';
  return 'unknown';
};

/**
 * Extracts a classified Persian message for API, connectivity and timeout
 * failures. Mutation cancellation while offline is intentionally surfaced as
 * a recoverable connectivity error rather than the caller's generic fallback.
 * @param {any} error
 * @param {string} fallback
 * @returns {string}
 */
export const getErrorMessage = (error, fallback) => {
  const localized = localizeServerMessage(error?.response?.data?.message);
  if (localized) return localized;

  if (error?.code === 'ERR_CANCELED' || String(error?.message || '').startsWith('Offline:')) {
    return 'اتصال اینترنت برقرار نیست. پس از اتصال دوباره تلاش کنید.';
  }
  if (error?.code === 'ECONNABORTED') {
    return 'زمان پاسخ‌گویی سرور به پایان رسید. اتصال خود را بررسی و دوباره تلاش کنید.';
  }
  if (error?.request && !error?.response) {
    return 'ارتباط با سرور برقرار نشد. اتصال اینترنت یا وضعیت سامانه را بررسی کنید.';
  }

  return fallback;
};

/**
 * Like `getErrorMessage`, but falls back to a classified Persian message for
 * 400/401/403/404/409/5xx when the server did not return a usable message,
 * instead of the caller's generic fallback. Opt-in for callers that want the
 * full classified mapping; existing `getErrorMessage` callers are unaffected.
 * @param {any} error
 * @param {string} fallback
 * @returns {string}
 */
export const getClassifiedErrorMessage = (error, fallback) => {
  const message = getErrorMessage(error, null);
  if (message) return message;

  const kind = classifyApiError(error);
  if (kind === 'offline') return 'اتصال اینترنت برقرار نیست. پس از اتصال دوباره تلاش کنید.';
  if (kind === 'timeout') return 'زمان پاسخ‌گویی سرور به پایان رسید. اتصال خود را بررسی و دوباره تلاش کنید.';
  if (kind === 'network') return 'ارتباط با سرور برقرار نشد. اتصال اینترنت یا وضعیت سامانه را بررسی کنید.';
  const status = error?.response?.status;
  if (status && STATUS_FALLBACKS[status]) return STATUS_FALLBACKS[status];
  if (kind === 'server') return 'خطای داخلی سرور رخ داد. کمی بعد دوباره تلاش کنید.';

  return fallback;
};
