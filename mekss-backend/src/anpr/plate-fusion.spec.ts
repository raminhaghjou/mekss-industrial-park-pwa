import { EngineCandidate } from './anpr.types';
import { PlateFusion } from './plate-fusion';

function candidate(plate: string, confidence: number, overrides: Partial<EngineCandidate> = {}): EngineCandidate {
  return {
    bbox: { x: 10, y: 10, w: 200, h: 45 },
    detConf: 0.9,
    source: 'primary',
    rectification: 'perspective',
    variants: 3,
    color: 'white',
    plateType: 'PRIVATE',
    colorConflict: false,
    plate,
    valid: true,
    confidence,
    charConfidences: [...plate].map(() => Math.pow(confidence, 1 / 8)),
    positions: [...plate].map((c) => {
      const p = Math.pow(confidence, 1 / 8);
      return [{ c, p }, { c: '?', p: 1 - p }];
    }),
    alternatives: [{ plate, p: confidence }],
    raw: plate,
    rawConfidence: confidence,
    partial: null,
    ...overrides,
  };
}

describe('PlateFusion', () => {
  it('locks after three agreeing confident frames', () => {
    const fusion = new PlateFusion();
    expect(fusion.push(candidate('12ب34567', 0.98)).state).toBe('scanning');
    expect(fusion.push(candidate('12ب34567', 0.98)).state).toBe('scanning');
    const update = fusion.push(candidate('12ب34567', 0.98));
    expect(update.state).toBe('locked');
    expect(update.fused?.plate).toBe('12ب34567');
    expect(update.fused?.agreeingFrames).toBe(3);
  });

  it('locks on agreement even when single frames are below the lock threshold', () => {
    const fusion = new PlateFusion();
    const first = fusion.push(candidate('12ب34567', 0.95));
    expect(first.fused?.confidence).toBeLessThan(0.97);
    fusion.push(candidate('12ب34567', 0.94));
    const update = fusion.push(candidate('12ب34567', 0.96));
    expect(update.state).toBe('locked');
    expect(update.fused?.confidence).toBeGreaterThan(0.99);
  });

  it('does not lock on agreement between weak frames', () => {
    const fusion = new PlateFusion();
    for (let i = 0; i < 5; i += 1) expect(fusion.push(candidate('12ب34567', 0.7)).state).toBe('scanning');
  });

  it('does not let one weak frame veto an otherwise strong agreement', () => {
    const fusion = new PlateFusion();
    fusion.push(candidate('12ب34567', 0.95));
    fusion.push(candidate('12ب34567', 0.6));
    expect(fusion.push(candidate('12ب34567', 0.91)).state).toBe('scanning');
    expect(fusion.push(candidate('12ب34567', 0.93)).state).toBe('locked');
  });

  it('keeps a contested character uncertain', () => {
    const fusion = new PlateFusion();
    const contested = (letter: string, other: string) => candidate(`12${letter}34567`, 0.9, {
      positions: [...`12${letter}34567`].map((c, i) => (i === 2 ? [{ c: letter, p: 0.55 }, { c: other, p: 0.45 }] : [{ c, p: 0.999 }])),
    });
    fusion.push(contested('ب', 'پ'));
    fusion.push(contested('پ', 'ب'));
    const update = fusion.push(contested('ب', 'پ'));
    expect(update.state).not.toBe('locked');
    expect(update.fused?.charConfidences[2]).toBeLessThan(0.9);
    expect(update.fused?.positions[2].map((x) => x.c)).toEqual(expect.arrayContaining(['ب', 'پ']));
  });

  it('locks after two near-certain frames', () => {
    const fusion = new PlateFusion();
    fusion.push(candidate('12ب34567', 0.995));
    expect(fusion.push(candidate('12ب34567', 0.995)).state).toBe('locked');
  });

  it('does not let one blurred misread flip a character', () => {
    const fusion = new PlateFusion();
    fusion.push(candidate('12ب34567', 0.9));
    fusion.push(candidate('12پ34567', 0.4));
    const update = fusion.push(candidate('12ب34567', 0.9));
    expect(update.fused?.plate).toBe('12ب34567');
  });

  it('ignores invalid reads and emits a candidate after many unlockable frames', () => {
    const fusion = new PlateFusion();
    expect(fusion.push(candidate('12ب3456', 0.9, { valid: false })).state).toBe('scanning');
    expect(fusion.push(null).state).toBe('scanning');
    let state = 'scanning';
    for (let i = 0; i < 10; i += 1) state = fusion.push(candidate('12ب34567', 0.6)).state;
    expect(state).toBe('candidate');
  });

  it('resets when a different vehicle is seen twice', () => {
    const fusion = new PlateFusion();
    fusion.push(candidate('12ب34567', 0.9));
    fusion.push(candidate('12ب34567', 0.9));
    fusion.push(candidate('98م76543', 0.95));
    fusion.push(candidate('98م76543', 0.95));
    const update = fusion.push(candidate('98م76543', 0.95));
    expect(update.fused?.plate).toBe('98م76543');
  });

  it('stays locked until reset', () => {
    const fusion = new PlateFusion();
    fusion.push(candidate('12ب34567', 0.995));
    fusion.push(candidate('12ب34567', 0.995));
    expect(fusion.push(candidate('98م76543', 0.99)).fused?.plate).toBe('12ب34567');
    fusion.reset();
    expect(fusion.isLocked).toBe(false);
    expect(fusion.current()).toBeNull();
  });
});
