import { describe, expect, it } from 'vitest';
import { extractGatePassCode, matchesGatePassNumber } from './gatePassCode';

describe('extractGatePassCode', () => {
  it('keeps a raw MEKSS token', () => {
    expect(extractGatePassCode('  MEKSS-0123abcd  ')).toBe('MEKSS-0123abcd');
  });

  it('pulls the token out of URLs and JSON payloads', () => {
    expect(extractGatePassCode('https://app.example/verify?code=MEKSS-ff00')).toBe('MEKSS-ff00');
    expect(extractGatePassCode('https://app.example/g/abc123xyz')).toBe('abc123xyz');
    expect(extractGatePassCode('{"id":"cuid123","factoryId":"f1"}')).toBe('cuid123');
  });

  it('normalises Persian digits and strips unsafe characters', () => {
    expect(extractGatePassCode('۱۲۳')).toBe('123');
    expect(extractGatePassCode('AB C#1')).toBe('ABC1');
  });
});

describe('matchesGatePassNumber', () => {
  const pass = { id: 'clx0000000000wxyz9876' };

  it('matches the first three characters of the printed number', () => {
    expect(matchesGatePassNumber(pass, 'wxy')).toBe(true);
    expect(matchesGatePassNumber(pass, 'WXYZ9876')).toBe(true);
  });

  it('ignores short or non-prefix queries', () => {
    expect(matchesGatePassNumber(pass, 'wx')).toBe(false);
    expect(matchesGatePassNumber(pass, '987')).toBe(false);
  });
});
