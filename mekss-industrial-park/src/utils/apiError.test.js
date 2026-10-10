import { describe, expect, it } from 'vitest';
import { classifyApiError, getClassifiedErrorMessage, getErrorMessage } from './apiError';

describe('getErrorMessage', () => {
  it('prefers a server-provided string message over the fallback', () => {
    const error = { response: { data: { message: 'شرح خطای سرور' } } };
    expect(getErrorMessage(error, 'پیش‌فرض')).toBe('شرح خطای سرور');
  });

  it('joins an array of server validation messages with the Persian separator', () => {
    const error = { response: { data: { message: ['خطای اول', 'خطای دوم'] } } };
    expect(getErrorMessage(error, 'پیش‌فرض')).toBe('خطای اول، خطای دوم');
  });

  it('localizes known English server messages, including each item of a validation array', () => {
    expect(getErrorMessage({ response: { data: { message: 'Phone number is already registered' } } }, 'x'))
      .toBe('این شماره موبایل قبلاً در سامانه ثبت شده است.');
    expect(getErrorMessage({
      response: { data: { message: ['password must be 10-128 characters and contain letters and numbers', 'phoneNumber must match /^09\\d{9}$/ regular expression'] } },
    }, 'x')).toBe('رمز عبور باید حداقل ۱۰ کاراکتر و شامل حروف انگلیسی و عدد باشد.، شماره موبایل معتبر نیست (۱۱ رقم و با ۰۹ شروع شود).');
    expect(getErrorMessage({ response: { data: { message: 'phoneNumber or username is required' } } }, 'x'))
      .toBe('نام کاربری یا شماره تلفن را وارد کنید.');
  });

  it('classifies an offline-blocked mutation as a recoverable connectivity error', () => {
    const error = { code: 'ERR_CANCELED', message: 'Offline: mutation blocked until reconnect' };
    expect(getErrorMessage(error, 'پیش‌فرض')).toContain('اتصال اینترنت برقرار نیست');
  });

  it('classifies a client timeout distinctly from a network failure', () => {
    expect(getErrorMessage({ code: 'ECONNABORTED' }, 'پیش‌فرض')).toContain('زمان پاسخ‌گویی سرور');
    expect(getErrorMessage({ request: {} }, 'پیش‌فرض')).toContain('ارتباط با سرور برقرار نشد');
  });

  it('falls back to the caller-provided message when nothing else applies', () => {
    expect(getErrorMessage({}, 'پیش‌فرض')).toBe('پیش‌فرض');
  });
});

describe('classifyApiError', () => {
  it.each([
    [{ code: 'ERR_CANCELED' }, 'offline'],
    [{ code: 'ECONNABORTED' }, 'timeout'],
    [{ request: {} }, 'network'],
    [{ response: { status: 401 } }, 'unauthorized'],
    [{ response: { status: 403 } }, 'forbidden'],
    [{ response: { status: 404 } }, 'not_found'],
    [{ response: { status: 409 } }, 'conflict'],
    [{ response: { status: 400 } }, 'validation'],
    [{ response: { status: 500 } }, 'server'],
    [{}, 'unknown'],
  ])('classifies %j as %s', (error, expected) => {
    expect(classifyApiError(error)).toBe(expected);
  });
});

describe('getClassifiedErrorMessage', () => {
  it('prefers the server message when present', () => {
    expect(getClassifiedErrorMessage({ response: { status: 409, data: { message: 'تعارض دقیق' } } }, 'پیش‌فرض')).toBe('تعارض دقیق');
  });

  it.each([
    [400, 'نامعتبر'],
    [401, 'منقضی'],
    [403, 'اجازه'],
    [404, 'یافت نشد'],
    [409, 'تعارض'],
  ])('maps status %i to a classified Persian fallback when the server sends no message', (status, expectedSubstring) => {
    expect(getClassifiedErrorMessage({ response: { status } }, 'پیش‌فرض')).toContain(expectedSubstring);
  });

  it('maps 5xx to a generic server-error message', () => {
    expect(getClassifiedErrorMessage({ response: { status: 503 } }, 'پیش‌فرض')).toContain('خطای داخلی سرور');
  });

  it('falls back to the caller-provided message for unclassified errors', () => {
    expect(getClassifiedErrorMessage({}, 'پیش‌فرض دلخواه')).toBe('پیش‌فرض دلخواه');
  });
});
