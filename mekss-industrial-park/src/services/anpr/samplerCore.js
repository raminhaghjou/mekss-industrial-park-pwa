/**
 * Pure helpers for the live plate frame sampler (usable in the worker, on the main thread
 * and in tests): ROI geometry, sharpness/motion gates and the in-flight backpressure gate.
 */

/** Guide box as fractions of the displayed video; matches the overlay in IranPlateOcrCamera. */
export const DEFAULT_GUIDE = { x: 0.08, y: 0.3, w: 0.84, h: 0.4 };

/**
 * Map the on-screen guide (object-fit: cover) to a crop rectangle in video pixels.
 * @param {{ videoW: number, videoH: number, viewW: number, viewH: number, guide?: typeof DEFAULT_GUIDE }} input
 */
export function computeRoi({ videoW, videoH, viewW, viewH, guide = DEFAULT_GUIDE }) {
  if (!videoW || !videoH) return { x: 0, y: 0, w: 0, h: 0 };
  const vw = viewW || videoW;
  const vh = viewH || videoH;
  const scale = Math.max(vw / videoW, vh / videoH);
  const shownW = vw / scale;
  const shownH = vh / scale;
  const offX = (videoW - shownW) / 2;
  const offY = (videoH - shownH) / 2;
  const x = Math.max(0, Math.round(offX + guide.x * shownW));
  const y = Math.max(0, Math.round(offY + guide.y * shownH));
  const w = Math.min(videoW - x, Math.round(guide.w * shownW));
  const h = Math.min(videoH - y, Math.round(guide.h * shownH));
  return { x, y, w, h };
}

/** Map a bbox in encoded-ROI pixels back to fractions of the displayed video (for the overlay). */
export function roiBoxToView(bbox, { roi, encodedW, encodedH, videoW, videoH, viewW, viewH }) {
  if (!bbox || !roi?.w || !encodedW) return null;
  const sx = roi.w / encodedW;
  const sy = roi.h / encodedH;
  const vx = roi.x + bbox.x * sx;
  const vy = roi.y + bbox.y * sy;
  const scale = Math.max(viewW / videoW, viewH / videoH);
  const offX = (videoW * scale - viewW) / 2;
  const offY = (videoH * scale - viewH) / 2;
  return {
    left: (vx * scale - offX) / viewW,
    top: (vy * scale - offY) / viewH,
    width: (bbox.w * sx * scale) / viewW,
    height: (bbox.h * sy * scale) / viewH,
  };
}

/** Output size for the encoded ROI: ~640px wide, never upscaled. */
export function encodeSize(roi, maxWidth = 640) {
  const scale = Math.min(1, maxWidth / Math.max(1, roi.w));
  return { width: Math.max(1, Math.round(roi.w * scale)), height: Math.max(1, Math.round(roi.h * scale)) };
}

/** Luma of RGBA pixels. */
export function toGray(rgba, width, height) {
  const out = new Float32Array(width * height);
  for (let i = 0, j = 0; i < out.length; i += 1, j += 4) {
    out[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  }
  return out;
}

/** Variance of the 4-neighbour Laplacian; low values mean a blurred frame. */
export function laplacianVariance(gray, width, height) {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      sum += v;
      sumSq += v * v;
      n += 1;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Mean absolute difference between two equally sized grayscale thumbnails (0..255). */
export function motionScore(prev, next) {
  if (!prev || !next || prev.length !== next.length || !next.length) return 0;
  let total = 0;
  for (let i = 0; i < next.length; i += 1) total += Math.abs(next[i] - prev[i]);
  return total / next.length;
}

export const DEFAULT_GATES = {
  /** Frames blurrier than this are not sent. */
  minSharpness: 60,
  /** Frames with heavy motion (camera shake, vehicle moving fast) are not sent. */
  maxMotion: 38,
  /** Identical scenes are re-sent at most this often, so a parked car is still re-read. */
  staticResendMs: 900,
  /** Below this motion the scene is considered unchanged. */
  staticMotion: 1.2,
};

/**
 * Decide whether to send a frame.
 * @returns {{ send: boolean, reason?: 'blur'|'motion'|'static' }}
 */
export function frameGate({ sharpness, motion, sinceLastSentMs }, gates = DEFAULT_GATES) {
  if (sharpness < gates.minSharpness) return { send: false, reason: 'blur' };
  if (motion > gates.maxMotion) return { send: false, reason: 'motion' };
  if (motion < gates.staticMotion && sinceLastSentMs < gates.staticResendMs) return { send: false, reason: 'static' };
  return { send: true };
}

/**
 * Bounded in-flight counter: `tryAcquire()` fails once `max` frames are awaiting a reply,
 * so a slow network never builds a queue of stale frames.
 */
export function createInFlightGate(max = 2) {
  let inFlight = 0;
  return {
    get inFlight() {
      return inFlight;
    },
    tryAcquire() {
      if (inFlight >= max) return false;
      inFlight += 1;
      return true;
    },
    release() {
      inFlight = Math.max(0, inFlight - 1);
    },
    reset() {
      inFlight = 0;
    },
  };
}
