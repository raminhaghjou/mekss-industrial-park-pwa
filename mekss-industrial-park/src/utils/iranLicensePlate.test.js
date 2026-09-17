import { describe, expect, it } from 'vitest';
import {
  IRAN_PLATE_REGIONS,
  findIranPlateRegion,
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

  it('maps Fars and West Azerbaijan region codes correctly from official tables', () => {
    expect(['63', '73', '83', '93'].map((code) => findIranPlateRegion(code)?.province))
      .toEqual(['فارس', 'فارس', 'فارس', 'فارس']);
    expect(findIranPlateRegion('17')?.province).toBe('آذربایجان غربی');
    expect(findIranPlateRegion('17')?.province).not.toBe('فارس');
    expect(IRAN_PLATE_REGIONS.filter((item) => item.province === 'فارس').map((item) => item.code))
      .toEqual(['63', '73', '83', '93']);
  });
});
