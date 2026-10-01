import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GATES,
  DEFAULT_GUIDE,
  computeRoi,
  createInFlightGate,
  encodeSize,
  frameGate,
  laplacianVariance,
  motionScore,
  roiBoxToView,
  toGray,
} from './samplerCore';

describe('computeRoi', () => {
  it('maps the guide directly when the view has the video aspect ratio', () => {
    const roi = computeRoi({ videoW: 1000, videoH: 500, viewW: 500, viewH: 250 });
    expect(roi).toEqual({ x: 80, y: 150, w: 840, h: 200 });
  });

  it('accounts for object-fit: cover cropping (portrait phone view of a landscape stream)', () => {
    const roi = computeRoi({ videoW: 1280, videoH: 720, viewW: 360, viewH: 720, guide: { x: 0, y: 0, w: 1, h: 1 } });
    expect(roi).toEqual({ x: 460, y: 0, w: 360, h: 720 });
  });

  it('never leaves the frame and handles missing dimensions', () => {
    const roi = computeRoi({ videoW: 640, videoH: 480, viewW: 640, viewH: 480, guide: { x: 0.9, y: 0.9, w: 0.5, h: 0.5 } });
    expect(roi.x + roi.w).toBeLessThanOrEqual(640);
    expect(roi.y + roi.h).toBeLessThanOrEqual(480);
    expect(computeRoi({ videoW: 0, videoH: 0 })).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('roiBoxToView', () => {
  it('round-trips a bbox from encoded ROI pixels back to view fractions', () => {
    const geometry = { videoW: 1000, videoH: 500, viewW: 1000, viewH: 500 };
    const roi = computeRoi({ ...geometry, guide: DEFAULT_GUIDE });
    const { width: encodedW, height: encodedH } = encodeSize(roi, 420);
    const box = roiBoxToView({ x: 0, y: 0, w: encodedW, h: encodedH }, { roi, encodedW, encodedH, ...geometry });
    expect(box.left).toBeCloseTo(DEFAULT_GUIDE.x, 2);
    expect(box.top).toBeCloseTo(DEFAULT_GUIDE.y, 2);
    expect(box.width).toBeCloseTo(DEFAULT_GUIDE.w, 2);
    expect(box.height).toBeCloseTo(DEFAULT_GUIDE.h, 2);
  });

  it('returns null without a bbox', () => {
    expect(roiBoxToView(null, {})).toBeNull();
  });
});

describe('encodeSize', () => {
  it('downscales to the max width and never upscales', () => {
    expect(encodeSize({ w: 1280, h: 320 })).toEqual({ width: 640, height: 160 });
    expect(encodeSize({ w: 300, h: 100 })).toEqual({ width: 300, height: 100 });
  });
});

describe('sharpness and motion', () => {
  const W = 16;
  const H = 16;
  const rgba = (fn) => {
    const out = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const v = fn(x, y);
        const i = (y * W + x) * 4;
        out[i] = v;
        out[i + 1] = v;
        out[i + 2] = v;
        out[i + 3] = 255;
      }
    }
    return out;
  };

  it('scores a checkerboard far sharper than a flat frame', () => {
    const sharp = laplacianVariance(toGray(rgba((x, y) => ((x + y) % 2 ? 255 : 0)), W, H), W, H);
    const flat = laplacianVariance(toGray(rgba(() => 128), W, H), W, H);
    expect(flat).toBe(0);
    expect(sharp).toBeGreaterThan(DEFAULT_GATES.minSharpness * 100);
  });

  it('measures mean absolute difference between thumbnails', () => {
    const a = Float32Array.from([0, 10, 20, 30]);
    const b = Float32Array.from([10, 10, 30, 30]);
    expect(motionScore(a, b)).toBe(5);
    expect(motionScore(null, b)).toBe(0);
    expect(motionScore(a, Float32Array.from([1]))).toBe(0);
  });
});

describe('frameGate', () => {
  it('drops blurred and shaky frames', () => {
    expect(frameGate({ sharpness: 10, motion: 5, sinceLastSentMs: 5000 })).toEqual({ send: false, reason: 'blur' });
    expect(frameGate({ sharpness: 500, motion: 90, sinceLastSentMs: 5000 })).toEqual({ send: false, reason: 'motion' });
  });

  it('throttles an unchanged scene but still re-sends it periodically', () => {
    expect(frameGate({ sharpness: 500, motion: 0.5, sinceLastSentMs: 200 })).toEqual({ send: false, reason: 'static' });
    expect(frameGate({ sharpness: 500, motion: 0.5, sinceLastSentMs: 2000 })).toEqual({ send: true });
    expect(frameGate({ sharpness: 500, motion: 8, sinceLastSentMs: 10 })).toEqual({ send: true });
  });
});

describe('createInFlightGate', () => {
  it('bounds the number of frames awaiting a reply', () => {
    const gate = createInFlightGate(2);
    expect(gate.tryAcquire()).toBe(true);
    expect(gate.tryAcquire()).toBe(true);
    expect(gate.tryAcquire()).toBe(false);
    expect(gate.inFlight).toBe(2);
    gate.release();
    expect(gate.tryAcquire()).toBe(true);
    gate.reset();
    expect(gate.inFlight).toBe(0);
    gate.release();
    expect(gate.inFlight).toBe(0);
  });
});
