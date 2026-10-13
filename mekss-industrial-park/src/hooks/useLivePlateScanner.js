import { useCallback, useEffect, useReducer, useRef } from 'react';
import { anprApi } from '../services/api/anpr.api';
import { createAnprConnection } from '../services/anpr/anprSocket';
import { createFrameSampler } from '../services/anpr/frameSampler';
import { DEFAULT_GUIDE, computeRoi, createInFlightGate } from '../services/anpr/samplerCore';
import { createDeviceFusion, initialScannerState, scannerReducer } from '../services/anpr/scannerMachine';

/** Frame cadence and in-flight budget per mode. */
const MODE_TIMING = {
  socket: { intervalMs: 125, maxInFlight: 2 },
  http: { intervalMs: 300, maxInFlight: 1 },
  device: { intervalMs: 600, maxInFlight: 1 },
};
const SOCKET_CONNECT_TIMEOUT_MS = 4000;
const HTTP_FAILURES_BEFORE_DEVICE = 3;
const SOCKET_FAILURES_BEFORE_HTTP = 3;

const newSessionId = () => {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `s${random}`.slice(0, 40);
};

const loadDeviceOcr = () => import('../utils/iranPlateOcr/iranPlateOcrClient');

/** Phone photos are several MB; plates stay legible at 1600px and the upload stays under the 2MB limit. */
async function downscalePhoto(file, maxSide = 1600) {
  const source = typeof createImageBitmap === 'function'
    ? await createImageBitmap(file)
    : await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  return blob.arrayBuffer();
}

/**
 * Continuous plate scanning from a live <video>.
 * Mode cascade: WebSocket → HTTP → on-device → manual; each step is taken automatically on failure
 * and the scanner climbs back to the socket when it reconnects.
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
  const httpFailuresRef = useRef(0);
  const socketFailuresRef = useRef(0);
  const deviceFusionRef = useRef(createDeviceFusion());
  const deviceOcrRef = useRef(null);
  const timerRef = useRef(null);
  const aliveRef = useRef(false);

  const setMode = useCallback((mode, reason) => {
    if (modeRef.current === mode) return;
    modeRef.current = mode;
    gateRef.current = createInFlightGate(MODE_TIMING[mode]?.maxInFlight ?? 1);
    samplerRef.current?.reset();
    dispatch({ type: 'MODE', mode, reason });
  }, []);

  const handleDecision = useCallback((decision, locked) => {
    if (!decision || stateRef.current.decision) return;
    dispatch({ type: 'DECISION', decision, locked });
  }, []);

  const enterDevice = useCallback(async (reason) => {
    try {
      deviceOcrRef.current = deviceOcrRef.current || await loadDeviceOcr();
      await deviceOcrRef.current.warmIranPlateOcr();
      if (!aliveRef.current) return;
      deviceFusionRef.current.reset();
      setMode('device', reason);
    } catch {
      if (aliveRef.current) setMode('manual', 'device-unavailable');
    }
  }, [setMode]);

  const enterHttp = useCallback(async (reason) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await enterDevice('offline');
      return;
    }
    try {
      await anprApi.status();
      if (!aliveRef.current) return;
      httpFailuresRef.current = 0;
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
          socketFailuresRef.current = 0;
          setMode('socket', null);
        } else if ((status === 'disconnected' || status === 'failed') && modeRef.current === 'socket') {
          enterHttp(detail || status);
        } else if (status === 'failed' && !settled) {
          settled = true;
          enterHttp(detail || 'socket-failed');
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

  const recognizeOnDevice = useCallback(async (image) => {
    const ocr = deviceOcrRef.current || await loadDeviceOcr();
    deviceOcrRef.current = ocr;
    const read = await ocr.recognizeIranPlate(new Blob([image], { type: 'image/jpeg' }));
    return read;
  }, []);

  const decideFromDevice = useCallback(async (read, locked) => {
    const base = {
      plate: read.plate,
      confidence: read.confidence,
      charConfidences: read.charConfidences,
      alternatives: read.alternatives,
      frames: read.frames || 1,
    };
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
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

  const tick = useCallback(async () => {
    const video = videoRef.current;
    const mode = modeRef.current;
    const gate = gateRef.current;
    if (!video || !mode || mode === 'manual' || stateRef.current.decision || video.readyState < 2) return;
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
      if (!sample.send || !sample.image || modeRef.current !== mode) return;
      const encoded = { width: sample.width, height: sample.height };
      const seq = (seqRef.current += 1);

      if (mode === 'socket') {
        metaRef.current.set(seq, { roi, encoded });
        if (metaRef.current.size > 16) metaRef.current.delete(metaRef.current.keys().next().value);
        const ack = await connRef.current.sendFrame(seq, sample.image);
        if (ack.ok) {
          socketFailuresRef.current = 0;
        } else if (ack.status && ack.status >= 500) {
          socketFailuresRef.current += 1;
          if (socketFailuresRef.current >= SOCKET_FAILURES_BEFORE_HTTP && modeRef.current === 'socket') {
            socketFailuresRef.current = 0;
            enterHttp('server-error');
          }
        }
        return;
      }

      if (mode === 'http') {
        try {
          const { data } = await anprApi.recognize(new Blob([sample.image], { type: 'image/jpeg' }), { sessionId: sessionRef.current });
          httpFailuresRef.current = 0;
          dispatch({ type: 'FRAME', outcome: data, roi, encoded });
          if (data.decision) handleDecision(data.decision, data.state === 'locked');
        } catch (error) {
          const status = error?.response?.status;
          if (status && status < 500 && status !== 408) return;
          httpFailuresRef.current += 1;
          if (httpFailuresRef.current >= HTTP_FAILURES_BEFORE_DEVICE) enterDevice('http-failed');
        }
        return;
      }

      if (mode === 'device') {
        const read = await recognizeOnDevice(sample.image);
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
  }, [decideFromDevice, enterDevice, enterHttp, handleDecision, recognizeOnDevice, videoRef]);

  // Lifecycle: start / stop scanning with `enabled`.
  useEffect(() => {
    if (!enabled) return undefined;
    const frameMeta = metaRef.current;
    aliveRef.current = true;
    sessionRef.current = newSessionId();
    samplerRef.current = createFrameSampler();
    dispatch({ type: 'START', mode: 'socket' });
    modeRef.current = null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) enterDevice('offline');
    else connectSocket();

    const loop = async () => {
      if (!aliveRef.current) return;
      const started = performance.now();
      tick();
      const interval = MODE_TIMING[modeRef.current]?.intervalMs ?? 250;
      timerRef.current = setTimeout(loop, Math.max(16, interval - (performance.now() - started)));
    };
    loop();

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
  }, [enabled, connectSocket, enterDevice, tick]);

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
    httpFailuresRef.current = 0;
    socketFailuresRef.current = 0;
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

  /** Still photo from `<input capture>` for browsers without getUserMedia. */
  const submitPhoto = useCallback(async (file) => {
    if (!file) return;
    dispatch({ type: 'RESCAN' });
    stateRef.current = { ...stateRef.current, decision: null };
    const image = await downscalePhoto(file);
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      try {
        const { data } = await anprApi.recognize(new Blob([image], { type: 'image/jpeg' }), { mode: 'photo' });
        if (data.decision) {
          dispatch({ type: 'DECISION', decision: data.decision, locked: data.state === 'locked' });
          return;
        }
        dispatch({ type: 'ERROR', message: 'پلاک در عکس خوانده نشد؛ عکس نزدیک‌تر و واضح‌تر بگیرید یا دستی وارد کنید.' });
        return;
      } catch {
        /* fall through to on-device OCR */
      }
    }
    try {
      const read = await recognizeOnDevice(image);
      if (read?.valid) await decideFromDevice({ ...read, frames: 1 }, (read.confidence ?? 0) >= 0.9);
      else dispatch({ type: 'ERROR', message: 'پلاک در عکس خوانده نشد؛ دستی وارد کنید.' });
    } catch {
      dispatch({ type: 'ERROR', message: 'پردازش عکس ناموفق بود؛ دستی وارد کنید.' });
    }
  }, [decideFromDevice, recognizeOnDevice]);

  return { state, rescan, reconnect, confirm, submitPhoto, sessionId: sessionRef.current };
}

export default useLivePlateScanner;
