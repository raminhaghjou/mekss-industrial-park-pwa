import { useCallback, useEffect, useReducer, useRef } from 'react';
import { anprApi } from '../services/api/anpr.api';
import { createAnprConnection } from '../services/anpr/anprSocket';
import { createFrameSampler } from '../services/anpr/frameSampler';
import { DEFAULT_GUIDE, computeRoi, createInFlightGate } from '../services/anpr/samplerCore';
import { createDeviceFusion, createFailureWindow, initialScannerState, scannerReducer } from '../services/anpr/scannerMachine';

/** Frame cadence and in-flight budget per mode. */
const MODE_TIMING = {
  socket: { intervalMs: 125, maxInFlight: 2 },
  http: { intervalMs: 300, maxInFlight: 1 },
  device: { intervalMs: 600, maxInFlight: 1 },
};
const SOCKET_CONNECT_TIMEOUT_MS = 4000;
/** While degraded, how often the server is probed so the scanner can climb back to live mode. */
export const RECOVERY_PROBE_MS = 20_000;
/** Sharpness gate steps: relaxed one step whenever no frame passed for `SHARPNESS_RELAX_MS`. */
export const SHARPNESS_STEPS = [60, 35, 20];
const SHARPNESS_RELAX_MS = 3000;
const DEVICE_PREWARM_DELAY_MS = 1500;
const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

const newSessionId = () => {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `s${random}`.slice(0, 40);
};

const loadDeviceOcr = () => import('../utils/iranPlateOcr/iranPlateOcrClient');

async function decodeOriented(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return { source: await createImageBitmap(file, { imageOrientation: 'from-image' }), url: null };
    } catch {
      try {
        return { source: await createImageBitmap(file), url: null };
      } catch {
        /* fall back to <img>, which applies EXIF orientation itself */
      }
    }
  }
  const url = URL.createObjectURL(file);
  const source = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
  return { source, url };
}

/** Phone photos are several MB; plates stay legible at 1600px and the upload stays under the 2MB limit. */
async function downscalePhoto(file, maxSide = 1600) {
  const { source, url } = await decodeOriented(file);
  try {
    const w = source.width || source.naturalWidth;
    const h = source.height || source.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('encode failed');
    return blob.arrayBuffer();
  } finally {
    source.close?.();
    if (url) URL.revokeObjectURL(url);
  }
}

/** Best partial read from the server (`bestGuess`) and the device, for prefilling manual entry. */
export function pickPhotoGuess(serverGuess, deviceRead) {
  const options = [];
  if (serverGuess && (serverGuess.plate || serverGuess.raw)) {
    options.push({ plate: serverGuess.plate || '', raw: serverGuess.raw || '', confidence: serverGuess.confidence || 0, source: 'server' });
  }
  if (deviceRead && (deviceRead.plate || deviceRead.raw)) {
    options.push({ plate: deviceRead.plate || '', raw: deviceRead.raw || '', confidence: deviceRead.confidence || 0, source: 'device' });
  }
  const score = (g) => (g.plate ? 10 : 0) + Math.min(8, (g.plate || g.raw).length) / 8 + g.confidence;
  return options.sort((a, b) => score(b) - score(a))[0] || null;
}

/**
 * Continuous plate scanning from a live <video>.
 * Mode cascade: WebSocket → HTTP → on-device → manual. A mode is only left on a sustained failure
 * rate (5 of the last 8 frames), the server is re-probed every 20 s while degraded, and manual mode
 * is used only when on-device OCR cannot run either.
 *
 * @param {{ videoRef: React.RefObject<HTMLVideoElement>, enabled: boolean, guide?: typeof DEFAULT_GUIDE }} options
 */
export function useLivePlateScanner({ videoRef, enabled, guide = DEFAULT_GUIDE }) {
  const [state, dispatch] = useReducer(scannerReducer, initialScannerState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const guideRef = useRef(guide);
  guideRef.current = guide;

  const modeRef = useRef(null);
  const connRef = useRef(null);
  const samplerRef = useRef(null);
  const gateRef = useRef(createInFlightGate(2));
  const seqRef = useRef(0);
  const metaRef = useRef(new Map());
  const sessionRef = useRef(newSessionId());
  const socketWindowRef = useRef(createFailureWindow());
  const httpWindowRef = useRef(createFailureWindow());
  const deviceWindowRef = useRef(createFailureWindow());
  const deviceFusionRef = useRef(createDeviceFusion());
  const deviceOcrRef = useRef(null);
  const timerRef = useRef(null);
  const aliveRef = useRef(false);
  const probingRef = useRef(false);
  const lastPassRef = useRef(0);
  const gateLevelRef = useRef(0);

  const setMode = useCallback((mode, reason) => {
    if (modeRef.current === mode) return;
    modeRef.current = mode;
    gateRef.current = createInFlightGate(MODE_TIMING[mode]?.maxInFlight ?? 1);
    samplerRef.current?.reset();
    socketWindowRef.current.reset();
    httpWindowRef.current.reset();
    deviceWindowRef.current.reset();
    dispatch({ type: 'MODE', mode, reason });
  }, []);

  const handleDecision = useCallback((decision, locked) => {
    if (!decision || stateRef.current.decision) return;
    dispatch({ type: 'DECISION', decision, locked });
  }, []);

  const ensureDeviceOcr = useCallback(async () => {
    deviceOcrRef.current = deviceOcrRef.current || await loadDeviceOcr();
    await deviceOcrRef.current.warmIranPlateOcr();
    return deviceOcrRef.current;
  }, []);

  const enterDevice = useCallback(async (reason) => {
    try {
      await ensureDeviceOcr();
      if (!aliveRef.current) return;
      deviceFusionRef.current.reset();
      setMode('device', reason);
    } catch {
      if (aliveRef.current) setMode('manual', reason === 'offline' ? 'offline' : 'device-unavailable');
    }
  }, [ensureDeviceOcr, setMode]);

  const enterHttp = useCallback(async (reason) => {
    if (!isOnline()) {
      await enterDevice('offline');
      return;
    }
    try {
      const available = await anprApi.serverAvailable();
      if (!aliveRef.current) return;
      if (!available) {
        await enterDevice('server-no-engine');
        return;
      }
      setMode('http', reason);
    } catch {
      await enterDevice('server-unreachable');
    }
  }, [enterDevice, setMode]);

  const connectSocket = useCallback(() => {
    connRef.current?.close();
    let settled = false;
    const conn = createAnprConnection({
      sessionId: sessionRef.current,
      onResult: (outcome) => {
        const meta = metaRef.current.get(outcome.seq);
        metaRef.current.delete(outcome.seq);
        dispatch({ type: 'FRAME', outcome, roi: meta?.roi, encoded: meta?.encoded });
      },
      onDecision: handleDecision,
      onStatus: (status, detail) => {
        if (!aliveRef.current) return;
        if (status === 'connected') {
          settled = true;
          setMode('socket', null);
        } else if ((status === 'disconnected' || status === 'failed') && modeRef.current === 'socket') {
          enterHttp(detail === 'unauthorized' || detail === 'forbidden' ? detail : 'socket-failed');
        } else if (status === 'failed' && !settled) {
          settled = true;
          enterHttp(detail === 'unauthorized' || detail === 'forbidden' ? detail : 'socket-failed');
        }
      },
    });
    connRef.current = conn;
    setTimeout(() => {
      if (!settled && aliveRef.current && !conn.connected) {
        settled = true;
        enterHttp('socket-timeout');
      }
    }, SOCKET_CONNECT_TIMEOUT_MS);
  }, [enterHttp, handleDecision, setMode]);

  const recognizeOnDevice = useCallback(async (image, mode = 'live') => {
    const ocr = deviceOcrRef.current || await loadDeviceOcr();
    deviceOcrRef.current = ocr;
    return ocr.recognizeIranPlate(new Blob([image], { type: 'image/jpeg' }), { mode });
  }, []);

  const decideFromDevice = useCallback(async (read, locked) => {
    const base = {
      plate: read.plate,
      confidence: read.confidence,
      charConfidences: read.charConfidences,
      alternatives: read.alternatives,
      frames: read.frames || 1,
    };
    if (isOnline()) {
      try {
        const { data } = await anprApi.match({ ...base, engine: 'DEVICE', sessionId: sessionRef.current });
        handleDecision({ ...data, requiresConfirmation: data.requiresConfirmation || !locked }, locked);
        return;
      } catch {
        /* offline or server down: show the read for manual confirmation */
      }
    }
    handleDecision({
      readId: null,
      plate: read.plate,
      plateType: read.plateType || null,
      confidence: read.confidence,
      engine: 'device',
      offline: true,
      requiresConfirmation: true,
      match: { outcome: 'NOT_FOUND', gatePasses: [], suggestions: [] },
    }, locked);
  }, [handleDecision]);

  /** No frame has passed the sharpness gate for a while: relax it one step and ask for a steadier hand. */
  const trackSharpness = useCallback((sample) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (sample.send) {
      lastPassRef.current = now;
      if (stateRef.current.hint) dispatch({ type: 'HINT', hint: null });
      return;
    }
    if (sample.reason !== 'blur' || now - lastPassRef.current < SHARPNESS_RELAX_MS) return;
    lastPassRef.current = now;
    if (gateLevelRef.current < SHARPNESS_STEPS.length - 1) {
      gateLevelRef.current += 1;
      samplerRef.current?.setGates?.({ minSharpness: SHARPNESS_STEPS[gateLevelRef.current] });
    }
    dispatch({ type: 'HINT', hint: 'steady', gateLevel: gateLevelRef.current });
  }, []);

  const tick = useCallback(async () => {
    const video = videoRef.current;
    const mode = modeRef.current;
    const gate = gateRef.current;
    if (!video || !mode || mode === 'manual' || stateRef.current.decision || stateRef.current.photoBusy || video.readyState < 2) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (!gate.tryAcquire()) return;

    const roi = computeRoi({
      videoW: video.videoWidth,
      videoH: video.videoHeight,
      viewW: video.clientWidth,
      viewH: video.clientHeight,
      guide: guideRef.current,
    });
    try {
      const sample = await samplerRef.current.sample(video, roi);
      trackSharpness(sample);
      if (!sample.send || !sample.image || modeRef.current !== mode) return;
      const encoded = { width: sample.width, height: sample.height };
      const seq = (seqRef.current += 1);

      if (mode === 'socket') {
        metaRef.current.set(seq, { roi, encoded });
        if (metaRef.current.size > 16) metaRef.current.delete(metaRef.current.keys().next().value);
        const ack = await connRef.current.sendFrame(seq, sample.image);
        if (ack.ok && ack.dropped) return;
        if (socketWindowRef.current.record(ack.ok) && modeRef.current === 'socket') {
          enterHttp(ack.status === 401 || ack.status === 403 ? 'unauthorized' : 'server-error');
        }
        return;
      }

      if (mode === 'http') {
        try {
          const { data } = await anprApi.recognize(new Blob([sample.image], { type: 'image/jpeg' }), { sessionId: sessionRef.current });
          httpWindowRef.current.record(true);
          dispatch({ type: 'FRAME', outcome: data, roi, encoded });
          if (data.decision) handleDecision(data.decision, data.state === 'locked');
        } catch (error) {
          // 400 = this frame was not a decodable image; it says nothing about the server.
          if (error?.response?.status === 400) return;
          if (httpWindowRef.current.record(false) && modeRef.current === 'http') enterDevice('http-failed');
        }
        return;
      }

      if (mode === 'device') {
        let read;
        try {
          read = await recognizeOnDevice(sample.image, 'live');
          deviceWindowRef.current.record(true);
        } catch {
          if (deviceWindowRef.current.record(false) && modeRef.current === 'device') setMode('manual', 'device-failed');
          return;
        }
        const box = read?.box;
        dispatch({
          type: 'FRAME',
          outcome: {
            engine: 'device',
            candidates: box ? [{ bbox: box, plate: read.plate, valid: read.valid, confidence: read.confidence }] : [],
            fused: read?.valid ? { plate: read.plate, confidence: read.confidence } : null,
          },
          roi,
          encoded,
        });
        const update = deviceFusionRef.current.push(read);
        if (update.state === 'locked' || update.state === 'candidate') {
          await decideFromDevice(update.read, update.state === 'locked');
        }
      }
    } catch {
      /* a failed frame is simply skipped */
    } finally {
      gate.release();
    }
  }, [decideFromDevice, enterDevice, enterHttp, handleDecision, recognizeOnDevice, setMode, trackSharpness, videoRef]);

  // Lifecycle: start / stop scanning with `enabled`.
  useEffect(() => {
    if (!enabled) return undefined;
    const frameMeta = metaRef.current;
    aliveRef.current = true;
    sessionRef.current = newSessionId();
    samplerRef.current = createFrameSampler();
    gateLevelRef.current = 0;
    lastPassRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    dispatch({ type: 'START', mode: 'socket' });
    modeRef.current = null;
    if (!isOnline()) {
      enterDevice('offline');
    } else {
      connectSocket();
      // No usable engine on the server: do not wait for frames to fail before going on-device.
      anprApi.serverAvailable()
        .then((available) => {
          if (!available && aliveRef.current && modeRef.current !== 'device') enterDevice('server-no-engine');
        })
        .catch(() => undefined);
    }

    const loop = async () => {
      if (!aliveRef.current) return;
      const started = performance.now();
      tick();
      const interval = MODE_TIMING[modeRef.current]?.intervalMs ?? 250;
      timerRef.current = setTimeout(loop, Math.max(16, interval - (performance.now() - started)));
    };
    loop();

    // Load the on-device models in the background so a server outage switches over instantly.
    const prewarm = setTimeout(() => {
      if (!aliveRef.current || navigator.connection?.saveData) return;
      ensureDeviceOcr().catch(() => undefined);
    }, DEVICE_PREWARM_DELAY_MS);

    const probe = setInterval(async () => {
      const mode = modeRef.current;
      if (!aliveRef.current || probingRef.current || !mode || mode === 'socket' || !isOnline()) return;
      if (stateRef.current.decision) return;
      probingRef.current = true;
      try {
        if (await anprApi.serverAvailable()) connectSocket();
      } catch {
        /* still down */
      } finally {
        probingRef.current = false;
      }
    }, RECOVERY_PROBE_MS);

    const onOnline = () => {
      if (modeRef.current !== 'socket') connectSocket();
    };
    const onOffline = () => {
      if (modeRef.current === 'socket' || modeRef.current === 'http') enterDevice('offline');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      aliveRef.current = false;
      clearTimeout(timerRef.current);
      clearTimeout(prewarm);
      clearInterval(probe);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      connRef.current?.close();
      connRef.current = null;
      samplerRef.current?.close();
      samplerRef.current = null;
      frameMeta.clear();
      modeRef.current = null;
      dispatch({ type: 'STOP' });
    };
  }, [enabled, connectSocket, enterDevice, ensureDeviceOcr, tick]);

  const rescan = useCallback(() => {
    samplerRef.current?.reset();
    deviceFusionRef.current.reset();
    gateRef.current.reset();
    if (modeRef.current === 'socket') connRef.current?.reset();
    else if (modeRef.current === 'http') anprApi.resetSession(sessionRef.current).catch(() => undefined);
    dispatch({ type: 'RESCAN' });
  }, []);

  /** Climb back up the cascade after it fell to manual (e.g. the server was briefly down). */
  const reconnect = useCallback(() => {
    if (!aliveRef.current) return;
    dispatch({ type: 'START', mode: 'socket' });
    modeRef.current = null;
    connectSocket();
  }, [connectSocket]);

  /** Record what the guard finally accepted (labelled data for evaluation / fine-tuning). */
  const confirm = useCallback(async ({ plate, gatePassId } = {}) => {
    const readId = stateRef.current.decision?.readId;
    if (!readId) return;
    const payload = { readId, plate, gatePassId };
    if (connRef.current?.connected) {
      const ack = await connRef.current.confirm(payload);
      if (ack?.ok) return;
    }
    await anprApi.confirmRead(readId, { plate, gatePassId }).catch(() => undefined);
  }, []);

  /**
   * Still photo (camera capture or gallery). The server reads it with multi-scale + tiled detection;
   * without a confident server read the phone reads it too, and the better result wins. When neither
   * is a complete plate, the best partial read is exposed as `state.guess` to prefill manual entry.
   */
  const submitPhoto = useCallback(async (file) => {
    if (!file) return;
    dispatch({ type: 'RESCAN' });
    stateRef.current = { ...stateRef.current, decision: null, photoBusy: true };
    dispatch({ type: 'PHOTO', busy: true });
    try {
      let image;
      try {
        image = await downscalePhoto(file);
      } catch {
        dispatch({ type: 'ERROR', message: 'این عکس قابل خواندن نیست؛ دوباره از پلاک عکس بگیرید.' });
        return;
      }

      let serverGuess = null;
      if (isOnline()) {
        try {
          const { data } = await anprApi.recognize(new Blob([image], { type: 'image/jpeg' }), { mode: 'photo' });
          if (data.decision) {
            dispatch({ type: 'DECISION', decision: data.decision, locked: data.state === 'locked' });
            return;
          }
          serverGuess = data.bestGuess || null;
        } catch {
          /* server unreachable or slow: the phone reads the photo instead */
        }
      }

      let deviceRead = null;
      try {
        deviceRead = await recognizeOnDevice(image, 'photo');
      } catch {
        /* device OCR unavailable */
      }
      if (deviceRead?.valid) {
        await decideFromDevice({ ...deviceRead, frames: 1 }, (deviceRead.confidence ?? 0) >= 0.97);
        return;
      }

      const guess = pickPhotoGuess(serverGuess, deviceRead);
      if (guess) {
        dispatch({ type: 'GUESS', guess });
        dispatch({ type: 'ERROR', message: 'پلاک کامل خوانده نشد؛ بخش‌های خوانده‌شده در کادر پلاک پر شد، باقی را دستی کامل کنید.' });
      } else {
        dispatch({ type: 'ERROR', message: 'پلاکی در عکس پیدا نشد؛ از فاصلهٔ نزدیک‌تر و روبه‌روی پلاک عکس بگیرید یا دستی وارد کنید.' });
      }
    } finally {
      stateRef.current = { ...stateRef.current, photoBusy: false };
      dispatch({ type: 'PHOTO', busy: false });
    }
  }, [decideFromDevice, recognizeOnDevice]);

  return { state, rescan, reconnect, confirm, submitPhoto, sessionId: sessionRef.current };
}

export default useLivePlateScanner;
