const normalizeServerMessage = (message) => {
  if (Array.isArray(message)) return message.filter(Boolean).join('، ');
  return typeof message === 'string' && message.trim() ? message : null;
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
  const serverMessage = normalizeServerMessage(error?.response?.data?.message);
  if (serverMessage) return serverMessage;

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
  const serverMessage = normalizeServerMessage(error?.response?.data?.message);
  if (serverMessage) return serverMessage;

  const kind = classifyApiError(error);
  if (kind === 'offline') return 'اتصال اینترنت برقرار نیست. پس از اتصال دوباره تلاش کنید.';
  if (kind === 'timeout') return 'زمان پاسخ‌گویی سرور به پایان رسید. اتصال خود را بررسی و دوباره تلاش کنید.';
  if (kind === 'network') return 'ارتباط با سرور برقرار نشد. اتصال اینترنت یا وضعیت سامانه را بررسی کنید.';
  const status = error?.response?.status;
  if (status && STATUS_FALLBACKS[status]) return STATUS_FALLBACKS[status];
  if (kind === 'server') return 'خطای داخلی سرور رخ داد. کمی بعد دوباره تلاش کنید.';

  return fallback;
};
