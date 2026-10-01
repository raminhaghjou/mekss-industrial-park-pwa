/**
 * Live plate scanner state machine.
 *
 * phase: idle → connecting → scanning → (locked) matched | suggest | notFound
 * mode (fallback cascade): socket → http → device → manual
 */

export const SCAN_MODES = ['socket', 'http', 'device', 'manual'];

export const ENGINE_LABELS = {
  python: 'سرور',
  node: 'سرور پشتیبان',
  device: 'روی دستگاه',
  manual: 'دستی',
};

export function nextMode(mode) {
  const i = SCAN_MODES.indexOf(mode);
  return i < 0 || i >= SCAN_MODES.length - 1 ? 'manual' : SCAN_MODES[i + 1];
}

export const initialScannerState = {
  phase: 'idle',
  mode: null,
  modeReason: null,
  engine: null,
  live: null,
  decision: null,
  error: null,
  frames: 0,
  latencyMs: null,
};

const phaseForMatch = (outcome) => {
  if (outcome === 'MATCHED') return 'matched';
  if (outcome === 'SUGGESTED') return 'suggest';
  return 'notFound';
};

export function scannerReducer(state, action) {
  switch (action.type) {
    case 'START':
      return { ...initialScannerState, phase: 'connecting', mode: action.mode || 'socket' };
    case 'MODE':
      return {
        ...state,
        mode: action.mode,
        modeReason: action.reason || null,
        phase: action.mode === 'manual' ? 'manual' : state.decision ? state.phase : 'scanning',
        error: null,
      };
    case 'FRAME': {
      if (state.decision) return state;
      const outcome = action.outcome || {};
      return {
        ...state,
        phase: 'scanning',
        engine: outcome.engine || state.engine,
        live: {
          candidates: outcome.candidates || [],
          fused: outcome.fused || null,
          image: outcome.image || null,
          roi: action.roi || null,
          encoded: action.encoded || null,
        },
        frames: state.frames + 1,
        latencyMs: outcome.latencyMs ?? state.latencyMs,
      };
    }
    case 'DECISION': {
      const decision = action.decision;
      if (!decision) return state;
      return {
        ...state,
        phase: phaseForMatch(decision.match?.outcome),
        engine: decision.engine || state.engine,
        decision: { ...decision, locked: action.locked !== false },
      };
    }
    case 'RESCAN':
      return { ...state, phase: state.mode === 'manual' ? 'manual' : 'scanning', decision: null, live: null, frames: 0, error: null };
    case 'ERROR':
      return { ...state, error: action.message || 'خطای نامشخص' };
    case 'STOP':
      return { ...initialScannerState };
    default:
      return state;
  }
}

/**
 * On-device fusion (the server fuses for socket/http modes): lock on `agree` consecutive
 * identical valid reads with at least `minConfidence`, else surface a candidate after `maxFrames`.
 */
export function createDeviceFusion({ agree = 2, minConfidence = 0.75, maxFrames = 8 } = {}) {
  let last = null;
  let streak = 0;
  let frames = 0;
  let best = null;
  let emitted = false;
  return {
    push(read) {
      if (emitted) return { state: 'done' };
      if (!read?.valid || !read.plate) return { state: 'scanning' };
      frames += 1;
      if (!best || read.confidence > best.confidence) best = read;
      streak = read.plate === last ? streak + 1 : 1;
      last = read.plate;
      if (streak >= agree && read.confidence >= minConfidence) {
        emitted = true;
        return { state: 'locked', read: { ...read, frames } };
      }
      if (frames >= maxFrames) {
        emitted = true;
        return { state: 'candidate', read: { ...best, frames } };
      }
      return { state: 'scanning' };
    },
    reset() {
      last = null;
      streak = 0;
      frames = 0;
      best = null;
      emitted = false;
    },
  };
}
