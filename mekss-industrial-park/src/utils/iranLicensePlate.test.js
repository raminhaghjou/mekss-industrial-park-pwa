import { describe, expect, it } from 'vitest';
import {
  formatIranLicensePlate,
  isCompleteIranLicensePlate,
  parseIranLicensePlate,
} from './iranLicensePlate';

describe('iranLicensePlate', () => {
  it('parses canonical and spaced plate strings', () => {
    expect(parseIranLicensePlate('12ب34567')).toEqual({
      series: '12',
      letter: 'ب',
      middle: '345',
      region: '67',
    });
    expect(parseIranLicensePlate('۱۲ ب ۳۴۵ ایران ۶۷')).toEqual({
      series: '12',
      letter: 'ب',
      middle: '345',
      region: '67',
    });
  });

  it('formats complete parts and rejects incomplete ones', () => {
    expect(formatIranLicensePlate({
      series: '12',
      letter: 'ب',
      middle: '345',
      region: '67',
    })).toBe('12ب34567');
    expect(formatIranLicensePlate({
      series: '12',
      letter: 'ب',
      middle: '34',
      region: '67',
    })).toBe('');
    expect(isCompleteIranLicensePlate('12ب34567')).toBe(true);
    expect(isCompleteIranLicensePlate('12ب34')).toBe(false);
  });
});
