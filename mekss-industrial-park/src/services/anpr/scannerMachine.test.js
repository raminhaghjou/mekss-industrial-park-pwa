import { describe, expect, it } from 'vitest';
import { createDeviceFusion, initialScannerState, nextMode, scannerReducer } from './scannerMachine';

const decision = (outcome, extra = {}) => ({
  readId: 'r1',
  plate: '12ب34567',
  engine: 'python',
  match: { outcome, gatePasses: [], suggestions: [] },
  ...extra,
});

describe('nextMode', () => {
  it('walks the fallback cascade and ends at manual', () => {
    expect(nextMode('socket')).toBe('http');
    expect(nextMode('http')).toBe('device');
    expect(nextMode('device')).toBe('manual');
    expect(nextMode('manual')).toBe('manual');
    expect(nextMode('unknown')).toBe('manual');
  });
});

describe('scannerReducer', () => {
  const start = () => scannerReducer(initialScannerState, { type: 'START', mode: 'socket' });

  it('starts connecting in the requested mode', () => {
    expect(start()).toMatchObject({ phase: 'connecting', mode: 'socket', decision: null, frames: 0 });
  });

  it('switches to scanning on a mode change and to manual at the end of the cascade', () => {
    const s = scannerReducer(start(), { type: 'MODE', mode: 'http', reason: 'socket-down' });
    expect(s).toMatchObject({ phase: 'scanning', mode: 'http', modeReason: 'socket-down' });
    expect(scannerReducer(s, { type: 'MODE', mode: 'manual' }).phase).toBe('manual');
  });

  it('counts frames and keeps live candidates', () => {
    let s = start();
    s = scannerReducer(s, { type: 'FRAME', outcome: { engine: 'node', latencyMs: 42, candidates: [{ plate: 'x' }] } });
    s = scannerReducer(s, { type: 'FRAME', outcome: { candidates: [] } });
    expect(s.frames).toBe(2);
    expect(s.engine).toBe('node');
    expect(s.latencyMs).toBe(42);
    expect(s.phase).toBe('scanning');
  });

  it.each([
    ['MATCHED', 'matched'],
    ['SUGGESTED', 'suggest'],
    ['NOT_FOUND', 'notFound'],
  ])('maps match outcome %s to phase %s', (outcome, phase) => {
    const s = scannerReducer(start(), { type: 'DECISION', decision: decision(outcome) });
    expect(s.phase).toBe(phase);
    expect(s.decision.locked).toBe(true);
  });

  it('ignores frames after a decision until rescan', () => {
    let s = scannerReducer(start(), { type: 'DECISION', decision: decision('MATCHED'), locked: false });
    expect(s.decision.locked).toBe(false);
    const frozen = scannerReducer(s, { type: 'FRAME', outcome: { candidates: [{ plate: 'y' }] } });
    expect(frozen).toBe(s);
    s = scannerReducer(s, { type: 'RESCAN' });
    expect(s).toMatchObject({ phase: 'scanning', decision: null, frames: 0 });
  });

  it('keeps the decision phase when the mode changes underneath it', () => {
    const s = scannerReducer(start(), { type: 'DECISION', decision: decision('SUGGESTED') });
    expect(scannerReducer(s, { type: 'MODE', mode: 'http' }).phase).toBe('suggest');
  });

  it('records errors and resets on stop', () => {
    const s = scannerReducer(start(), { type: 'ERROR', message: 'boom' });
    expect(s.error).toBe('boom');
    expect(scannerReducer(s, { type: 'STOP' })).toEqual(initialScannerState);
  });
});

describe('createDeviceFusion', () => {
  const read = (plate, confidence, valid = true) => ({ plate, confidence, valid });

  it('locks after two agreeing confident reads', () => {
    const f = createDeviceFusion();
    expect(f.push(read('12ب34567', 0.9)).state).toBe('scanning');
    const out = f.push(read('12ب34567', 0.8));
    expect(out.state).toBe('locked');
    expect(out.read).toMatchObject({ plate: '12ب34567', frames: 2 });
    expect(f.push(read('12ب34567', 0.9)).state).toBe('done');
  });

  it('does not lock on disagreeing or low-confidence reads', () => {
    const f = createDeviceFusion();
    f.push(read('12ب34567', 0.9));
    expect(f.push(read('12پ34567', 0.9)).state).toBe('scanning');
    expect(f.push(read('12پ34567', 0.5)).state).toBe('scanning');
  });

  it('ignores invalid reads and surfaces the best candidate after maxFrames', () => {
    const f = createDeviceFusion({ maxFrames: 3 });
    expect(f.push(read('', 0, false)).state).toBe('scanning');
    f.push(read('12ب34567', 0.6));
    f.push(read('12پ34567', 0.7));
    const out = f.push(read('12ت34567', 0.65));
    expect(out.state).toBe('candidate');
    expect(out.read).toMatchObject({ plate: '12پ34567', frames: 3 });
  });

  it('can be reset for the next vehicle', () => {
    const f = createDeviceFusion();
    f.push(read('12ب34567', 0.9));
    f.push(read('12ب34567', 0.9));
    f.reset();
    expect(f.push(read('45ع12311', 0.9)).state).toBe('scanning');
  });
});
