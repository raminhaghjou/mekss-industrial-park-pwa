/**
 * Main-thread facade for Iranian plate OCR worker (Platrix ONNX).
 */
let worker = null;
let seq = 0;
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./iranPlateOcr.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const data = event.data || {};
    const { type, id } = data;
    if (type === 'progress') {
      pending.get(id)?.onProgress?.(data);
      return;
    }
    const entry = id ? pending.get(id) : null;
    if (!entry) return;
    if (type === 'result' || type === 'inited') {
      pending.delete(id);
      entry.resolve(type === 'result' ? data.result : true);
      return;
    }
    if (type === 'error') {
      pending.delete(id);
      entry.reject(new Error(data.message || 'OCR failed'));
    }
  };
  worker.onerror = (err) => {
    const message = err?.message || 'Worker error';
    pending.forEach((entry) => entry.reject(new Error(message)));
    pending.clear();
  };
  return worker;
}

export function warmIranPlateOcr(onProgress) {
  const id = `init-${seq += 1}`;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    ensureWorker().postMessage({ type: 'init', id });
  });
}

/**
 * @param {ImageBitmap|HTMLCanvasElement|HTMLVideoElement|Blob} source
 * @param {{ onProgress?: Function }} [opts]
 */
export async function recognizeIranPlate(source, opts = {}) {
  const id = `ocr-${seq += 1}`;
  let bitmap = source instanceof ImageBitmap ? source : await createImageBitmap(source);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress: opts.onProgress });
    ensureWorker().postMessage({ type: 'recognize', id, bitmap }, [bitmap]);
  });
}

export function terminateIranPlateOcr() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pending.clear();
}
