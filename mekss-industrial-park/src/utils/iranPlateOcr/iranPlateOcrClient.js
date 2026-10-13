/**
 * Main-thread facade for the Iranian plate OCR worker (Platrix ONNX).
 * Every call has a deadline; a crashed or hung worker is terminated and recreated on the next call,
 * so the device fallback can never freeze the scanner.
 */
export const WARM_TIMEOUT_MS = 25_000;
export const RECOGNIZE_TIMEOUT_MS = { live: 6_000, photo: 15_000 };

let worker = null;
let seq = 0;
let warmed = null;
const pending = new Map();

function failAll(message) {
  pending.forEach((entry) => {
    clearTimeout(entry.timer);
    entry.reject(new Error(message));
  });
  pending.clear();
}

/** Drops the worker (and its loaded models); the next call starts a fresh one. */
export function terminateIranPlateOcr(reason = 'OCR worker reset') {
  if (worker) {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
    worker = null;
  }
  warmed = null;
  failAll(reason);
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./iranPlateOcr.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const data = event.data || {};
    const { type, id } = data;
    const entry = id ? pending.get(id) : null;
    if (!entry) return;
    if (type === 'progress') {
      entry.onProgress?.(data);
      return;
    }
    if (type === 'result' || type === 'inited') {
      pending.delete(id);
      clearTimeout(entry.timer);
      entry.resolve(type === 'result' ? data.result : true);
      return;
    }
    if (type === 'error') {
      pending.delete(id);
      clearTimeout(entry.timer);
      entry.reject(new Error(data.message || 'OCR failed'));
    }
  };
  worker.onerror = (err) => {
    err?.preventDefault?.();
    terminateIranPlateOcr(err?.message || 'خطای پردازشگر OCR روی دستگاه');
  };
  return worker;
}

function call(message, { timeoutMs, onProgress, transfer = [] }) {
  const id = `${message.type}-${seq += 1}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      // A hung inference keeps the worker busy forever; start over with a fresh one.
      terminateIranPlateOcr('پردازش روی دستگاه بیش از حد طول کشید');
    }, timeoutMs);
    pending.set(id, { resolve, reject, onProgress, timer });
    try {
      ensureWorker().postMessage({ ...message, id }, transfer);
    } catch (error) {
      pending.delete(id);
      clearTimeout(timer);
      reject(error);
    }
  });
}

/** Loads the models once; concurrent callers share the same warm-up. */
export function warmIranPlateOcr(onProgress) {
  if (!warmed) {
    warmed = call({ type: 'init' }, { timeoutMs: WARM_TIMEOUT_MS, onProgress }).catch((error) => {
      warmed = null;
      throw error;
    });
  }
  return warmed;
}

async function decode(source) {
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) return source;
  if (typeof createImageBitmap !== 'function') throw new Error('مرورگر از پردازش تصویر پشتیبانی نمی‌کند');
  try {
    return await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch {
    return createImageBitmap(source);
  }
}

/** Workers without OffscreenCanvas (older Safari) get raw pixels drawn on the main thread instead. */
function toImageData(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width, height };
}

/**
 * @param {ImageBitmap|HTMLCanvasElement|HTMLVideoElement|Blob} source
 * @param {{ onProgress?: Function, mode?: 'live' | 'photo' }} [opts]
 */
export async function recognizeIranPlate(source, opts = {}) {
  const mode = opts.mode === 'photo' ? 'photo' : 'live';
  const bitmap = await decode(source);
  if (typeof OffscreenCanvas === 'undefined' && typeof document !== 'undefined') {
    const image = toImageData(bitmap);
    return call({ type: 'recognize', image, mode }, {
      timeoutMs: RECOGNIZE_TIMEOUT_MS[mode],
      onProgress: opts.onProgress,
      transfer: [image.data.buffer],
    });
  }
  return call({ type: 'recognize', bitmap, mode }, {
    timeoutMs: RECOGNIZE_TIMEOUT_MS[mode],
    onProgress: opts.onProgress,
    transfer: [bitmap],
  });
}
