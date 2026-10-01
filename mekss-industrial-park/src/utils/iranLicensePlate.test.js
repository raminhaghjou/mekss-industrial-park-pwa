import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  IRAN_PLATE_REGIONS,
  displayIranLicensePlate,
  findIranPlateRegion,
  formatIranFreeZonePlate,
  formatIranLicensePlate,
  iranPlateTypeOf,
  isCompleteIranLicensePlate,
  isKnownIranPlateRegion,
  normalizeIranPlate,
  parseIranFreeZonePlate,
  parseIranLicensePlate,
  plateTypeForLetter,
} from './iranLicensePlate';

const vectors = JSON.parse(
  readFileSync(resolve(process.cwd(), '..', 'shared', 'anpr', 'plate-grammar.vectors.json'), 'utf8'),
);

describe('shared plate grammar vectors (same file as backend and mekss-anpr)', () => {
  it.each(vectors.normalize)('normalises $input', ({ input, plate, valid, plateType }) => {
    const out = normalizeIranPlate(input);
    expect(out.plate).toBe(plate);
    expect(out.valid).toBe(valid);
    expect(out.plateType).toBe(plateType);
  });

  it('classifies region codes', () => {
    vectors.regions.known.forEach((code) => expect(isKnownIranPlateRegion(code)).toBe(true));
    vectors.regions.unknown.forEach((code) => expect(isKnownIranPlateRegion(code)).toBe(false));
  });
});

describe('plate types and free-zone plates', () => {
  it('derives plate type from the letter', () => {
    expect(plateTypeForLetter('ب')).toBe('PRIVATE');
    expect(plateTypeForLetter('ع')).toBe('PUBLIC');
    expect(plateTypeForLetter('X')).toBeNull();
    expect(iranPlateTypeOf('12ت34567')).toBe('TAXI');
  });

  it('parses, formats and displays free-zone plates', () => {
    expect(parseIranFreeZonePlate('FZ-KISH-12345')).toEqual({ zone: 'KISH', number: '12345' });
    expect(formatIranFreeZonePlate({ zone: 'KISH', number: '12345' })).toBe('FZ-KISH-12345');
    expect(formatIranFreeZonePlate({ zone: 'NOPE', number: '12345' })).toBe('');
    expect(isCompleteIranLicensePlate('FZ-KISH-12345')).toBe(true);
    expect(displayIranLicensePlate('FZ-KISH-12345')).toContain('12345');
  });
});

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
