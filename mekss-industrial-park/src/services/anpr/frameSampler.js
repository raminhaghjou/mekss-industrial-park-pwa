import { DEFAULT_GATES, encodeSize, frameGate, laplacianVariance, motionScore, toGray } from './samplerCore';

const THUMB_W = 160;

export function supportsWorkerSampling() {
  return typeof Worker !== 'undefined'
    && typeof OffscreenCanvas !== 'undefined'
    && typeof OffscreenCanvas.prototype.convertToBlob === 'function'
    && typeof createImageBitmap === 'function';
}

/**
 * Crops the guide ROI from the live <video>, gates it and returns JPEG bytes.
 * Uses the worker (OffscreenCanvas) when available; older Safari falls back to canvas.toBlob.
 */
export function createFrameSampler({ gates = DEFAULT_GATES, maxWidth = 640, quality = 0.85 } = {}) {
  const useWorker = supportsWorkerSampling();
  let worker = null;
  let seq = 0;
  const pending = new Map();

  if (useWorker) {
    worker = new Worker(new URL('./frameSampler.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const data = event.data || {};
      const resolve = pending.get(data.id);
      if (!resolve) return;
      pending.delete(data.id);
      resolve(data);
    };
    worker.onerror = () => {
      pending.forEach((resolve) => resolve({ send: false, reason: 'error' }));
      pending.clear();
    };
    worker.postMessage({ type: 'config', gates });
  }

  // Main-thread fallback state.
  let canvas = null;
  let thumb = null;
  let prevThumb = null;
  let lastSentAt = 0;

  const sampleOnMainThread = (video, roi, force) => new Promise((resolve) => {
    const tw = THUMB_W;
    const th = Math.max(8, Math.round((roi.h / roi.w) * tw));
    thumb = thumb || document.createElement('canvas');
    if (thumb.width !== tw || thumb.height !== th) {
      thumb.width = tw;
      thumb.height = th;
      prevThumb = null;
    }
    const tctx = thumb.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(video, roi.x, roi.y, roi.w, roi.h, 0, 0, tw, th);
    const gray = toGray(tctx.getImageData(0, 0, tw, th).data, tw, th);
    const sharpness = laplacianVariance(gray, tw, th);
    const motion = prevThumb ? motionScore(prevThumb, gray) : gates.maxMotion / 2;
    prevThumb = gray;
    const now = performance.now();
    const gate = force ? { send: true } : frameGate({ sharpness, motion, sinceLastSentMs: now - lastSentAt }, gates);
    if (!gate.send) {
      resolve({ send: false, reason: gate.reason, sharpness, motion });
      return;
    }
    const { width, height } = encodeSize(roi, maxWidth);
    canvas = canvas || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d', { alpha: false }).drawImage(video, roi.x, roi.y, roi.w, roi.h, 0, 0, width, height);
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve({ send: false, reason: 'error' });
        return;
      }
      lastSentAt = now;
      resolve({ send: true, image: await blob.arrayBuffer(), width, height, sharpness, motion });
    }, 'image/jpeg', quality);
  });

  return {
    usesWorker: useWorker,
    /**
     * @param {HTMLVideoElement|HTMLCanvasElement|ImageBitmap} source
     * @param {{x:number,y:number,w:number,h:number}} roi in source pixels
     */
    async sample(source, roi, { force = false } = {}) {
      if (!roi?.w || !roi?.h) return { send: false, reason: 'no-roi' };
      if (!worker) return sampleOnMainThread(source, roi, force);
      const bitmap = await createImageBitmap(source, roi.x, roi.y, roi.w, roi.h);
      const id = (seq += 1);
      return new Promise((resolve) => {
        pending.set(id, resolve);
        worker.postMessage({ type: 'frame', id, bitmap, force, maxWidth, quality }, [bitmap]);
      });
    },
    reset() {
      prevThumb = null;
      lastSentAt = 0;
      worker?.postMessage({ type: 'reset' });
    },
    close() {
      worker?.terminate();
      worker = null;
      pending.forEach((resolve) => resolve({ send: false, reason: 'closed' }));
      pending.clear();
    },
  };
}
