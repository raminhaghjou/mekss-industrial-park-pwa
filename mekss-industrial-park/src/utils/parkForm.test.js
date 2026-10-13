import { describe, expect, it } from 'vitest';
import { validateParkForm } from './parkForm';
import { compactFaAmount } from './compactAmount';

const valid = { name: 'شهرک صنعتی شمس‌آباد', province: 'تهران', city: 'تهران', address: 'جاده قم', phoneNumber: '02112345678', guardPhone: '' };

describe('validateParkForm', () => {
  it('accepts a complete form without a park code or guard phone', () => {
    expect(validateParkForm(valid)).toEqual({});
  });

  it('reports every missing required field in Persian', () => {
    const errors = validateParkForm({ name: ' ', province: '', city: '', address: '', phoneNumber: '123', guardPhone: '12' });
    expect(Object.keys(errors).sort()).toEqual(['address', 'city', 'guardPhone', 'name', 'phoneNumber', 'province']);
  });
});

describe('compactFaAmount', () => {
  it('keeps small amounts exact and compacts large ones', () => {
    expect(compactFaAmount(950_000)).toBeNull();
    expect(compactFaAmount(12_500_000_000)).toBe(`${(12.5).toLocaleString('fa-IR')} میلیارد`);
    expect(compactFaAmount(3_000_000_000_000)).toBe(`${(3).toLocaleString('fa-IR')} هزار میلیارد`);
    expect(compactFaAmount('nope')).toBeNull();
  });
});
