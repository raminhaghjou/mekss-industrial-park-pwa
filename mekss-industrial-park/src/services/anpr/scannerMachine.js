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

/** Persian status chip shown on the camera for each mode. */
export const MODE_STATUS = {
  socket: { label: 'پردازش سرور', tone: 'ok' },
  http: { label: 'پردازش سرور (کند)', tone: 'warn' },
  device: { label: 'پردازش روی گوشی', tone: 'info' },
  manual: { label: 'سرور در دسترس نیست', tone: 'off' },
};

/** Why the scanner left the live server mode, in words the guard understands. */
export const MODE_REASON_LABELS = {
  offline: 'اینترنت قطع است',
  'server-unreachable': 'سرور تشخیص پلاک پاسخ نمی‌دهد',
  'server-no-engine': 'موتور تشخیص پلاک روی سرور آماده نیست',
  'server-error': 'سرور در خواندن تصاویر خطا می‌دهد',
  'http-failed': 'ارسال تصویر به سرور مکرراً ناموفق بود',
  'socket-timeout': 'اتصال زنده برقرار نشد',
  'socket-failed': 'اتصال زنده برقرار نشد',
  'device-unavailable': 'مدل تشخیص روی این گوشی بارگذاری نشد',
  'device-failed': 'پردازش روی گوشی مکرراً ناموفق بود',
  unauthorized: 'نشست کاربری منقضی شده است',
  forbidden: 'اجازه استفاده از تشخیص پلاک را ندارید',
};

/**
 * Sliding window over the last `size` frame outcomes: trips once `limit` of them failed, so a few
 * slow or dropped frames never knock the scanner down a mode, but a sustained outage does.
 */
export function createFailureWindow({ size = 8, limit = 5 } = {}) {
  let outcomes = [];
  return {
    /** @param {boolean} ok @returns {boolean} true when the failure limit is reached */
    record(ok) {
      outcomes.push(Boolean(ok));
      if (outcomes.length > size) outcomes = outcomes.slice(-size);
      return outcomes.filter((x) => !x).length >= limit;
    },
    get failures() {
      return outcomes.filter((x) => !x).length;
    },
    reset() {
      outcomes = [];
    },
  };
}

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
  /** 'steady' when frames keep failing the sharpness gate. */
  hint: null,
  /** Index into the relaxed sharpness thresholds (0 = strictest). */
  gateLevel: 0,
  /** Best partial read of a still photo, used to prefill manual entry. */
  guess: null,
  photoBusy: false,
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
      return { ...state, phase: state.mode === 'manual' ? 'manual' : 'scanning', decision: null, live: null, frames: 0, error: null, guess: null };
    case 'ERROR':
      return { ...state, error: action.message || 'خطای نامشخص' };
    case 'HINT':
      if (state.hint === (action.hint || null) && state.gateLevel === (action.gateLevel ?? state.gateLevel)) return state;
      return { ...state, hint: action.hint || null, gateLevel: action.gateLevel ?? state.gateLevel };
    case 'GUESS':
      return { ...state, guess: action.guess || null };
    case 'PHOTO':
      return { ...state, photoBusy: Boolean(action.busy) };
    case 'STOP':
      return { ...initialScannerState };
    default:
      return state;
  }
}

/**
 * On-device fusion (the server fuses for socket/http modes), same thresholds as the server:
 * lock on `agree` consecutive identical valid reads of at least `minConfidence`, or on a single
 * valid read of at least `certainConfidence`; else surface the best read after `maxFrames`.
 */
export function createDeviceFusion({ agree = 2, minConfidence = 0.8, certainConfidence = 0.97, maxFrames = 4 } = {}) {
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
      const strong = read.confidence >= minConfidence;
      streak = read.plate === last && strong ? streak + 1 : strong ? 1 : 0;
      last = read.plate;
      if (streak >= agree || read.confidence >= certainConfidence) {
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
