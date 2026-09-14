/**
 * Amount input helpers — display with `/` thousand separators (e.g. 1/500/000).
 */

const DIGITS = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

function toAsciiDigits(value) {
  return String(value ?? '').replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d] || d);
}

/** Strip formatting → plain numeric string (keeps one decimal point). */
export function parseAmountInput(value, { allowDecimal = false } = {}) {
  let raw = toAsciiDigits(value).replace(/[^\d.]/g, '');
  if (!allowDecimal) return raw.replace(/\./g, '');
  const parts = raw.split('.');
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 6)}`;
}

/** Format for display in inputs: 1500000 → 1/500/000 */
export function formatAmountInput(value, { allowDecimal = false } = {}) {
  const parsed = parseAmountInput(value, { allowDecimal });
  if (!parsed) return '';
  if (!allowDecimal) {
    return parsed.replace(/\B(?=(\d{3})+(?!\d))/g, '/');
  }
  const [intPart, decPart] = parsed.split('.');
  const formattedInt = (intPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '/');
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

export function amountInputToNumber(value, { allowDecimal = false } = {}) {
  const parsed = parseAmountInput(value, { allowDecimal });
  if (!parsed) return NaN;
  return allowDecimal ? Number(parsed) : Number(parsed);
}
