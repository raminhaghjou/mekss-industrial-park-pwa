import { readFileSync } from 'fs';
import { join } from 'path';
import {
  IRAN_LICENSE_PLATE_PATTERN,
  canonicalPlateOrRaw,
  displayPlate,
  isKnownRegion,
  normalizePlate,
  plateDistance,
} from './plate-grammar';

type Vectors = {
  normalize: { input: string; plate: string; valid: boolean; plateType: string | null }[];
  regions: { known: string[]; unknown: string[] };
  distance: { a: string; b: string; max?: number; min?: number }[];
};

const vectors = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'shared', 'anpr', 'plate-grammar.vectors.json'), 'utf8'),
) as Vectors;

describe('plate grammar (shared vectors with Python and the PWA)', () => {
  it.each(vectors.normalize)('normalizes %j', ({ input, plate, valid, plateType }) => {
    const result = normalizePlate(input);
    expect(result.valid).toBe(valid);
    expect(result.plate).toBe(plate);
    expect(result.plateType).toBe(plateType);
  });

  it('classifies region codes', () => {
    for (const code of vectors.regions.known) expect(isKnownRegion(code)).toBe(true);
    for (const code of vectors.regions.unknown) expect(isKnownRegion(code)).toBe(false);
  });

  it.each(vectors.distance)('confusion-weighted distance %j', ({ a, b, max, min }) => {
    const d = plateDistance(a, b);
    if (max !== undefined) expect(d).toBeLessThanOrEqual(max);
    if (min !== undefined) expect(d).toBeGreaterThanOrEqual(min);
  });

  it('keeps canonical plates accepted by the gate-pass DTO pattern', () => {
    for (const { plate, valid } of vectors.normalize) {
      if (valid) expect(IRAN_LICENSE_PLATE_PATTERN.test(plate)).toBe(true);
    }
    expect(IRAN_LICENSE_PLATE_PATTERN.test('FZ-NOWHERE-12345')).toBe(false);
  });

  it('falls back to a stripped legacy value when not normalizable', () => {
    expect(canonicalPlateOrRaw('12 AB 345 67')).toBe('12AB34567');
    expect(canonicalPlateOrRaw('fz-kish-12345')).toBe('FZ-KISH-12345');
  });

  it('renders display strings', () => {
    expect(displayPlate('12ا34567')).toBe('12 الف 345-67');
    expect(displayPlate('FZ-KISH-12345')).toBe('کیش 12345');
  });
});
