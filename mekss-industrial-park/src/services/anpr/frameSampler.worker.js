/* eslint-disable no-restricted-globals */
/**
 * Frame sampler worker: scales the guide-box ROI, rejects blurred / shaky / unchanged frames
 * and JPEG-encodes the rest, entirely off the UI thread.
 */
import { DEFAULT_GATES, encodeSize, frameGate, laplacianVariance, motionScore, toGray } from './samplerCore.js';

const THUMB_W = 160;
let canvas = null;
let thumb = null;
let prevThumb = null;
let lastSentAt = 0;
let gates = DEFAULT_GATES;

function ensureCanvas(width, height) {
  if (!canvas) canvas = new OffscreenCanvas(width, height);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas.getContext('2d', { alpha: false, willReadFrequently: false });
}

function metrics(bitmap) {
  const tw = THUMB_W;
  const th = Math.max(8, Math.round((bitmap.height / bitmap.width) * tw));
  if (!thumb) thumb = new OffscreenCanvas(tw, th);
  if (thumb.width !== tw || thumb.height !== th) {
    thumb.width = tw;
    thumb.height = th;
    prevThumb = null;
  }
  const ctx = thumb.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, tw, th);
  const gray = toGray(ctx.getImageData(0, 0, tw, th).data, tw, th);
  const sharpness = laplacianVariance(gray, tw, th);
  const motion = prevThumb ? motionScore(prevThumb, gray) : gates.maxMotion / 2;
  prevThumb = gray;
  return { sharpness, motion };
}

async function handleFrame({ id, bitmap, force, maxWidth = 640, quality = 0.85 }) {
  try {
    const { sharpness, motion } = metrics(bitmap);
    const now = performance.now();
    const gate = force ? { send: true } : frameGate({ sharpness, motion, sinceLastSentMs: now - lastSentAt }, gates);
    if (!gate.send) {
      self.postMessage({ type: 'frame', id, send: false, reason: gate.reason, sharpness, motion });
      return;
    }
    const { width, height } = encodeSize({ w: bitmap.width, h: bitmap.height }, maxWidth);
    const ctx = ensureCanvas(width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    const image = await blob.arrayBuffer();
    lastSentAt = now;
    self.postMessage({ type: 'frame', id, send: true, image, width, height, sharpness, motion }, [image]);
  } catch (error) {
    self.postMessage({ type: 'frame', id, send: false, reason: 'error', error: error?.message || String(error) });
  } finally {
    bitmap.close?.();
  }
}

self.onmessage = (event) => {
  const data = event.data || {};
  if (data.type === 'frame') handleFrame(data);
  else if (data.type === 'config') gates = { ...DEFAULT_GATES, ...(data.gates || {}) };
  else if (data.type === 'reset') {
    prevThumb = null;
    lastSentAt = 0;
  }
};
