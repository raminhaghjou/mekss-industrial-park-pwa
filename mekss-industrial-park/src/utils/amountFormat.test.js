import { describe, expect, it } from 'vitest';
import { amountInputToNumber, formatAmountInput, parseAmountInput } from './amountFormat';

describe('amountFormat', () => {
  it('formats with slash thousand separators', () => {
    expect(formatAmountInput('1500000')).toBe('1/500/000');
    expect(formatAmountInput('500000')).toBe('500/000');
    expect(formatAmountInput('۱۲۳۴۵۶۷')).toBe('1/234/567');
  });

  it('parses formatted amounts back to numbers', () => {
    expect(parseAmountInput('1/500/000')).toBe('1500000');
    expect(amountInputToNumber('1/500/000')).toBe(1500000);
  });

  it('supports decimals when enabled', () => {
    expect(formatAmountInput('1234.56', { allowDecimal: true })).toBe('1/234.56');
    expect(amountInputToNumber('1/234.5', { allowDecimal: true })).toBe(1234.5);
  });
});
