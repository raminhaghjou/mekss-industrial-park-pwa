import { digitsOnly } from './digits';

/** Mirrors the backend `strongPassword` rule (10-128 chars with at least one Latin letter and one digit). */
export const STAFF_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{10,128}$/;
export const STAFF_PASSWORD_HINT = 'حداقل ۱۰ کاراکتر، شامل حروف انگلیسی و عدد (مثلاً Mekss14051)';

/** Persian/Arabic digits → ASCII, `+98`/`0098` prefix → `0`, capped at 11 digits (Iranian mobile). */
export const normalizeStaffPhone = (value) => {
  let digits = digitsOnly(value);
  if (digits.startsWith('0098')) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('98') && digits.length >= 12) digits = `0${digits.slice(2)}`;
  return digits.slice(0, 11);
};

/** Returns Persian validation messages keyed by field; empty object when the form is valid. */
export const validateStaffForm = (form, { requirePassword = true } = {}) => {
  const errors = {};
  if (!form.name || form.name.trim().length < 2) errors.name = 'نام و نام خانوادگی را کامل وارد کنید.';
  if (!/^09\d{9}$/.test(form.phoneNumber || '')) errors.phoneNumber = 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.';
  if (requirePassword || form.password) {
    if (!form.password) errors.password = 'رمز عبور اولیه را وارد کنید.';
    else if (!STAFF_PASSWORD_PATTERN.test(form.password)) errors.password = `رمز عبور معتبر نیست؛ ${STAFF_PASSWORD_HINT}.`;
  }
  if (form.nationalId && !/^\d{10}$/.test(form.nationalId)) errors.nationalId = 'کد ملی باید ۱۰ رقم باشد.';
  if (form.username && !/^[a-z0-9._-]{3,64}$/.test(form.username)) {
    errors.username = 'نام کاربری فقط حروف کوچک انگلیسی، عدد و . _ - (۳ تا ۶۴ کاراکتر).';
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'ایمیل معتبر نیست.';
  return errors;
};

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';

const randomIndex = (max) => {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] % max;
};

/** Generates a 12-character password that always satisfies `STAFF_PASSWORD_PATTERN` (no look-alike characters). */
export const generateStaffPassword = (length = 12) => {
  const pool = LETTERS + DIGITS;
  const chars = [LETTERS[randomIndex(LETTERS.length)], DIGITS[randomIndex(DIGITS.length)]];
  while (chars.length < length) chars.push(pool[randomIndex(pool.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};
