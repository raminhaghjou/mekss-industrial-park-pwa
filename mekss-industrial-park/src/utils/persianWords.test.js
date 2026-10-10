import { describe, expect, it } from 'vitest';
import { numberToPersianWords } from './persianWords';

describe('numberToPersianWords', () => {
  it.each([
    [0, 'صفر'],
    [7, 'هفت'],
    [15, 'پانزده'],
    [120, 'صد و بیست'],
    [1000, 'یک هزار'],
    [500000, 'پانصد هزار'],
    [1500000, 'یک میلیون و پانصد هزار'],
    [2_000_000_000, 'دو میلیارد'],
    [12_345, 'دوازده هزار و سیصد و چهل و پنج'],
  ])('spells %i', (value, expected) => {
    expect(numberToPersianWords(value)).toBe(expected);
  });

  it('returns an empty string for invalid input', () => {
    expect(numberToPersianWords(NaN)).toBe('');
    expect(numberToPersianWords(-5)).toBe('');
  });
});
