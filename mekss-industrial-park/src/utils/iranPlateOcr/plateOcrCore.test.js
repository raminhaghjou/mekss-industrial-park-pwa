import { describe, expect, it } from 'vitest';
import { ctcGreedyDecode, normalizeIranPlateOcr, toAsciiDigits } from './plateOcrCore';

describe('iran plate OCR normalize', () => {
  it('converts persian digits', () => {
    expect(toAsciiDigits('۱۲ب۳۴۵۶۷')).toBe('12ب34567');
  });

  it('accepts compact canonical plates', () => {
    expect(normalizeIranPlateOcr('12ب34567')).toMatchObject({
      valid: true,
      plate: '12ب34567',
    });
  });

  it('accepts spaced persian OCR output', () => {
    expect(normalizeIranPlateOcr('۸۱ و ۶۳۸ ۱۳')).toMatchObject({
      valid: true,
      plate: '81و63813',
    });
  });

  it('rejects incomplete strings', () => {
    expect(normalizeIranPlateOcr('12ب34')).toMatchObject({ valid: false });
  });
});

describe('ctc greedy decode', () => {
  it('collapses blanks and repeats', () => {
    const labels = ['0', '1', 'ب'];
    // T=4, C+1=4 (blank=3): 1,1,blank,ب → "1ب"
    const logits = [
      // t0: class1
      -2, 5, -1, 0,
      // t1: class1 again
      -2, 4, -1, 0,
      // t2: blank
      -1, -1, -1, 6,
      // t3: letter
      -2, -2, 5, 0,
    ];
    const decoded = ctcGreedyDecode(logits, 4, 4, labels);
    expect(decoded.raw).toBe('1ب');
  });
});
