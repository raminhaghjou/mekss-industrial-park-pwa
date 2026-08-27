const normalizeServerMessage = (message) => {
  if (Array.isArray(message)) return message.filter(Boolean).join('، ');
  return typeof message === 'string' && message.trim() ? message : null;
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
