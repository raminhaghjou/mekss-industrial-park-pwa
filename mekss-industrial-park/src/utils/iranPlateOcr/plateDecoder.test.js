import { describe, expect, it } from 'vitest';
import { constrainedBeamSearch, greedyDecode, positionPrior, regionPrior, softmaxRows } from './plateDecoder';

const LABELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'د', 'ز', 'س', 'ش', 'ص', 'ط', 'ع', 'ق', 'ل', 'م', 'ن', 'ه', 'و', 'پ', 'ژ', 'ی'];
const C = LABELS.length + 1;
const BLANK = LABELS.length;

/** Each step is `{ char: p }`; the remaining mass goes to blank. A blank step is inserted after every char. */
function ctcMatrix(steps) {
  const rows = [];
  for (const step of steps) {
    const row = new Float64Array(C);
    let used = 0;
    for (const [ch, p] of Object.entries(step)) {
      row[LABELS.indexOf(ch)] = p;
      used += p;
    }
    row[BLANK] = Math.max(0, 1 - used);
    rows.push(row);
    const blank = new Float64Array(C);
    blank[BLANK] = 1;
    rows.push(blank);
  }
  const probs = new Float64Array(rows.length * C);
  rows.forEach((r, t) => probs.set(r, t * C));
  return { probs, T: rows.length };
}

const certain = (plate) => [...plate].map((ch) => ({ [ch]: 0.99 }));

describe('softmaxRows', () => {
  it('normalises each time step', () => {
    const out = softmaxRows(Float32Array.from([1, 2, 3, 0, 0, 0]), 2, 3);
    expect(out[0] + out[1] + out[2]).toBeCloseTo(1, 10);
    expect(out[3]).toBeCloseTo(1 / 3, 10);
    expect(out[2]).toBeGreaterThan(out[1]);
  });
});

describe('greedyDecode', () => {
  it('collapses repeats and drops blanks', () => {
    const { probs, T } = ctcMatrix(certain('11ب22233'));
    expect(greedyDecode(probs, T, LABELS).raw).toBe('11ب22233');
  });
});

describe('constrainedBeamSearch', () => {
  it('decodes a clean plate with high confidence', () => {
    const { probs, T } = ctcMatrix(certain('12ب34567'));
    const out = constrainedBeamSearch(probs, T, LABELS);
    expect(out.valid).toBe(true);
    expect(out.plate).toBe('12ب34567');
    expect(out.probability).toBeGreaterThan(0.9);
    expect(out.charConfidences).toHaveLength(8);
    expect(out.positions[2][0].c).toBe('ب');
  });

  it('forces a letter into the letter slot even when a digit is more likely there', () => {
    const steps = certain('12ب34567');
    steps[2] = { 8: 0.6, ب: 0.35 };
    const { probs, T } = ctcMatrix(steps);
    const greedy = greedyDecode(probs, T, LABELS);
    expect(greedy.raw).toBe('12834567');
    const out = constrainedBeamSearch(probs, T, LABELS);
    expect(out.plate).toBe('12ب34567');
  });

  it('keeps confusable letters as ranked alternatives', () => {
    const steps = certain('12ب34567');
    steps[2] = { ب: 0.55, پ: 0.4 };
    const { probs, T } = ctcMatrix(steps);
    const out = constrainedBeamSearch(probs, T, LABELS);
    expect(out.plate).toBe('12ب34567');
    const alt = out.alternatives.find((a) => a.plate === '12پ34567');
    expect(alt).toBeDefined();
    expect(alt.p).toBeGreaterThan(0.2);
    expect(out.positions[2].map((x) => x.c)).toEqual(expect.arrayContaining(['ب', 'پ']));
  });

  it('prefers an allocated region code over an unallocated one', () => {
    const steps = certain('12ب34535');
    steps[7] = { 9: 0.52, 5: 0.46 };
    const { probs, T } = ctcMatrix(steps);
    expect(constrainedBeamSearch(probs, T, LABELS).plate).toBe('12ب34535');
  });

  it('returns an invalid result when fewer than eight characters are visible', () => {
    const { probs, T } = ctcMatrix(certain('12ب345'));
    const out = constrainedBeamSearch(probs, T, LABELS);
    expect(out.valid).toBe(false);
    expect(out.plate).toBe('');
    expect(out.raw).toBe('12ب345');
  });
});

describe('priors', () => {
  it('penalise leading zeros and unallocated regions', () => {
    expect(positionPrior(0, '0')).toBeLessThan(1);
    expect(positionPrior(3, '0')).toBeLessThan(1);
    expect(positionPrior(1, '0')).toBe(1);
    expect(regionPrior('10')).toBe(1);
    expect(regionPrior('39')).toBeLessThan(1);
    expect(regionPrior('05')).toBeLessThan(1);
  });
});
