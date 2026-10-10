const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII so a Persian keyboard works in numeric fields. */
export const toAsciiDigits = (value) => String(value ?? '')
  .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));

/** Keeps only digits (after normalizing Persian/Arabic ones), optionally capped at `maxLength`. */
export const digitsOnly = (value, maxLength) => {
  const digits = toAsciiDigits(value).replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
};
