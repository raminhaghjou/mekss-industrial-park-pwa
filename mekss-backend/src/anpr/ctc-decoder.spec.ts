import { readFileSync } from 'fs';
import { join } from 'path';
import { constrainedBeamSearch, greedyDecode, mergeDecodes } from './ctc-decoder';

const LABELS = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'mekss-anpr', 'models', 'ocr_crnn.labels.json'), 'utf8')) as string[];

/** T x (C+1) probability matrix whose best CTC path spells `text` (mirrors mekss-anpr tests/conftest.py). */
function ctcMatrix(text: string, confidence = 0.96, alternatives: Record<number, Record<string, number>> = {}, framesPerChar = 3) {
  const classes = LABELS.length + 1;
  const blank = LABELS.length;
  const rows: number[][] = [];
  const row = (dist: Record<number, number>) => {
    const r = new Array(classes).fill(1e-6);
    let sum = 0;
    for (const [idx, p] of Object.entries(dist)) {
      r[Number(idx)] = p;
      sum += p;
    }
    r[blank] += Math.max(1 - sum, 0);
    const total = r.reduce((a, b) => a + b, 0);
    return r.map((v) => v / total);
  };
  rows.push(row({ [blank]: 0.99 }));
  [...text].forEach((ch, i) => {
    let dist: Record<number, number> = { [LABELS.indexOf(ch)]: confidence };
    for (const [alt, p] of Object.entries(alternatives[i] ?? {})) {
      dist = { [LABELS.indexOf(ch)]: confidence - p, [LABELS.indexOf(alt)]: p };
    }
    for (let k = 0; k < framesPerChar; k += 1) rows.push(row(dist));
    rows.push(row({ [blank]: 0.99 }));
  });
  return { probs: Float64Array.from(rows.flat()), timeSteps: rows.length };
}

describe('constrained CTC beam search', () => {
  it('decodes a clean plate with high confidence', () => {
    const { probs, timeSteps } = ctcMatrix('12ب34567');
    const result = constrainedBeamSearch(probs, timeSteps, LABELS);
    expect(result.valid).toBe(true);
    expect(result.plate).toBe('12ب34567');
    expect(result.probability).toBeGreaterThan(0.5);
    expect(result.charConfidences).toHaveLength(8);
    expect(result.positions[2][0].c).toBe('ب');
  });

  it('matches greedy decoding on unambiguous input', () => {
    const { probs, timeSteps } = ctcMatrix('45ع12311');
    expect(greedyDecode(probs, timeSteps, LABELS).raw).toBe('45ع12311');
  });

  it('forces a letter into the letter slot even when a digit is locally likelier', () => {
    const { probs, timeSteps } = ctcMatrix('12ب34567', 0.96, { 2: { '8': 0.6 } });
    const result = constrainedBeamSearch(probs, timeSteps, LABELS);
    expect(result.valid).toBe(true);
    expect(result.plate[2]).toBe('ب');
  });

  it('surfaces the confusable letter as an alternative', () => {
    const { probs, timeSteps } = ctcMatrix('12ب34567', 0.96, { 2: { 'پ': 0.4 } });
    const result = constrainedBeamSearch(probs, timeSteps, LABELS);
    expect(result.plate).toBe('12ب34567');
    expect(result.alternatives.map((a) => a.plate)).toContain('12پ34567');
    expect(result.positions[2].map((p) => p.c)).toContain('پ');
  });

  it('penalises a leading zero in the series', () => {
    const { probs, timeSteps } = ctcMatrix('02ب34567', 0.96, { 0: { '8': 0.35 } });
    expect(constrainedBeamSearch(probs, timeSteps, LABELS).plate).toBe('82ب34567');
  });

  it('merges test-time-augmentation decodes by label', () => {
    const a = ctcMatrix('12ب34567');
    const b = ctcMatrix('12ب34567', 0.9, { 2: { 'پ': 0.45 } });
    const merged = mergeDecodes([
      constrainedBeamSearch(a.probs, a.timeSteps, LABELS),
      constrainedBeamSearch(b.probs, b.timeSteps, LABELS),
    ]);
    expect(merged?.plate).toBe('12ب34567');
    expect(merged?.valid).toBe(true);
  });
});
