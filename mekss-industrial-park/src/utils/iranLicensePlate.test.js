import { describe, expect, it } from 'vitest';
import {
  IRAN_PLATE_REGIONS,
  displayIranLicensePlate,
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

  it('displays plates in readable Iranian format for UI', () => {
    expect(displayIranLicensePlate('13ب87863')).toBe('13 ب 878-63');
    expect(displayIranLicensePlate('12ا12345')).toBe('12 الف 123-45');
    expect(displayIranLicensePlate('bad')).toBe('bad');
  });

  it('maps Fars and West Azerbaijan region codes correctly from official tables', () => {
    expect(['63', '73', '83', '93'].map((code) => findIranPlateRegion(code)?.province))
      .toEqual(['فارس', 'فارس', 'فارس', 'فارس']);
    expect(findIranPlateRegion('17')?.province).toBe('آذربایجان غربی');
    expect(findIranPlateRegion('17')?.province).not.toBe('فارس');
    expect(IRAN_PLATE_REGIONS.filter((item) => item.province === 'فارس').map((item) => item.code))
      .toEqual(['63', '73', '83', '93']);
  });

  it('matches Wikipedia allocated province codes and omits unallocated ones', () => {
    const codes = IRAN_PLATE_REGIONS.map((item) => item.code);
    expect(codes).toHaveLength(86);
    expect(new Set(codes).size).toBe(86);
    // Official table: not allocated yet
    expect(codes).not.toContain('39');
    expect(codes).not.toContain('70');
    expect(codes).not.toContain('80');
    expect(codes).not.toContain('90');
    // Spot-check key provinces
    expect(findIranPlateRegion('19')?.province).toBe('کرمانشاه');
    expect(findIranPlateRegion('29')?.province).toBe('کرمانشاه');
    expect(findIranPlateRegion('91')?.province).toBe('اردبیل');
    expect(findIranPlateRegion('98')?.province).toBe('ایلام');
    expect(findIranPlateRegion('16')?.province).toBe('قم');
    expect(findIranPlateRegion('49')?.province).toBe('کهگیلویه و بویراحمد');
  });
});
