import { AnprStats, failureReason } from './anpr-stats';
import { plateGuess } from './anpr.service';
import { EngineCandidate, EngineResult, EngineUnavailableError, InvalidImageError } from './anpr.types';

const candidate = (over: Partial<EngineCandidate>): EngineCandidate => ({
  bbox: { x: 0, y: 0, w: 100, h: 25 },
  detConf: 0.9,
  source: 'yolo',
  rectification: 'none',
  variants: 1,
  color: 'white',
  plateType: null,
  colorConflict: false,
  plate: '',
  valid: false,
  confidence: 0,
  charConfidences: [],
  positions: [],
  alternatives: [],
  raw: '',
  rawConfidence: 0,
  partial: null,
  ...over,
});

const result = (candidates: EngineCandidate[], detections?: number): EngineResult => ({
  ok: true, engine: 'python', modelVersion: 't', image: { w: 1, h: 1 }, candidates, timings: {}, detections,
});

describe('AnprStats', () => {
  it('summarises a window per engine and mode, then resets', () => {
    const stats = new AnprStats();
    stats.record('python', 'live', 80, result([], 0));
    stats.record('python', 'live', 120, result([candidate({ valid: true, plate: '12ب34567' })], 1));
    stats.fail('python', 'photo', 'timeout');
    stats.failover();
    stats.record('node', 'photo', 300, result([candidate({ raw: '12ب' })], 1));

    const line = stats.drain();
    expect(line).toContain('python/live n=2 avg=100ms max=120ms detected=1 plate=1');
    expect(line).toContain('node/photo n=1 avg=300ms max=300ms detected=1 plate=0');
    expect(line).toContain('python/photo:timeout=1');
    expect(line).toContain('failovers=1');
    expect(stats.drain()).toBeNull();
  });

  it('names failure reasons by kind, then by error type', () => {
    expect(failureReason(new EngineUnavailableError('slow', true, 'timeout'))).toBe('timeout');
    expect(failureReason(new InvalidImageError())).toBe('InvalidImageError');
    expect(failureReason('boom')).toBe('error');
  });
});

describe('plateGuess (photo prefill)', () => {
  it('prefers a valid plate over a longer raw read', () => {
    const guess = plateGuess([
      candidate({ raw: '12345678', rawConfidence: 0.9 }),
      candidate({ valid: true, plate: '12ب34567', raw: '12ب34567', confidence: 0.6 }),
    ]);
    expect(guess).toMatchObject({ valid: true, plate: '12ب34567', confidence: 0.6 });
  });

  it('falls back to the strongest partial raw string and ignores fragments', () => {
    expect(plateGuess([candidate({ raw: '1' }), candidate({ raw: '' })])).toBeNull();
    const guess = plateGuess([candidate({ raw: '12ب', rawConfidence: 0.4 }), candidate({ raw: '12ب345', rawConfidence: 0.5 })]);
    expect(guess).toMatchObject({ valid: false, plate: '', raw: '12ب345', confidence: 0.5 });
  });
});
