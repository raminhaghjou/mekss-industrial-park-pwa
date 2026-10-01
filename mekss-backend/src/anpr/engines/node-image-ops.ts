/**
 * Image operations for the in-process Node ANPR engine (sharp + typed arrays).
 * Mirrors mekss-anpr's OpenCV pipeline closely enough for a fail-over engine:
 * letterbox with 114 padding, Platrix-style CRNN enhancement (upscale, denoise,
 * CLAHE, unsharp), projection-profile deskew and HSV plate-colour hints.
 */
import sharp = require('sharp');
import { InvalidImageError } from '../anpr.types';
import { prepCrnnGray } from './crnn-prep';

export interface RgbImage {
  data: Buffer;
  width: number;
  height: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CRNN_W = 128;
export const CRNN_H = 32;

export async function decodeToRgb(input: Buffer, maxSide: number): Promise<RgbImage> {
  try {
    const { data, info } = await sharp(input, { failOn: 'error' })
      .rotate()
      .removeAlpha()
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 3) throw new InvalidImageError();
    return { data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError();
  }
}

export async function letterboxTensor(img: RgbImage, size: number) {
  const ratio = Math.min(size / img.height, size / img.width);
  const nw = Math.max(1, Math.round(img.width * ratio));
  const nh = Math.max(1, Math.round(img.height * ratio));
  const dw = (size - nw) / 2;
  const dh = (size - nh) / 2;
  const top = Math.round(dh - 0.1);
  const left = Math.round(dw - 0.1);
  const data = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } })
    .resize(nw, nh, { fit: 'fill', kernel: 'mitchell' })
    .extend({ top, left, bottom: size - nh - top, right: size - nw - left, background: { r: 114, g: 114, b: 114 } })
    .raw()
    .toBuffer();
  const plane = size * size;
  const tensor = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    tensor[i] = data[i * 3] / 255;
    tensor[plane + i] = data[i * 3 + 1] / 255;
    tensor[2 * plane + i] = data[i * 3 + 2] / 255;
  }
  return { tensor, ratio, padX: left, padY: top };
}

export function cropRgb(img: RgbImage, box: Box): RgbImage {
  const x = Math.max(0, Math.min(img.width - 1, Math.round(box.x)));
  const y = Math.max(0, Math.min(img.height - 1, Math.round(box.y)));
  const w = Math.max(1, Math.min(img.width - x, Math.round(box.w)));
  const h = Math.max(1, Math.min(img.height - y, Math.round(box.h)));
  const out = Buffer.allocUnsafe(w * h * 3);
  for (let row = 0; row < h; row += 1) {
    const src = ((y + row) * img.width + x) * 3;
    img.data.copy(out, row * w * 3, src, src + w * 3);
  }
  return { data: out, width: w, height: h };
}

export function padBox(box: Box, width: number, height: number, frac: number): Box {
  const px = Math.round(box.w * frac);
  const py = Math.round(box.h * frac);
  const x1 = Math.max(0, box.x - px);
  const y1 = Math.max(0, box.y - py);
  const x2 = Math.min(width, box.x + box.w + px);
  const y2 = Math.min(height, box.y + box.h + py);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function shiftVariants(img: RgbImage, frac = 0.03): RgbImage[] {
  const dx = Math.max(1, Math.round(img.width * frac));
  const dy = Math.max(1, Math.round(img.height * frac));
  const variants: RgbImage[] = [];
  if (img.width > 4 * dx && img.height > 4 * dy) {
    variants.push(cropRgb(img, { x: dx, y: dy, w: img.width - 2 * dx, h: img.height - 2 * dy }));
  }
  variants.push(replicatePad(img, dx, dy));
  return variants;
}

function replicatePad(img: RgbImage, dx: number, dy: number): RgbImage {
  const w = img.width + 2 * dx;
  const h = img.height + 2 * dy;
  const out = Buffer.allocUnsafe(w * h * 3);
  for (let row = 0; row < h; row += 1) {
    const sy = Math.min(img.height - 1, Math.max(0, row - dy));
    for (let col = 0; col < w; col += 1) {
      const sx = Math.min(img.width - 1, Math.max(0, col - dx));
      const si = (sy * img.width + sx) * 3;
      const di = (row * w + col) * 3;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
    }
  }
  return { data: out, width: w, height: h };
}

export function toGray(img: RgbImage): Uint8Array {
  const out = new Uint8Array(img.width * img.height);
  for (let i = 0; i < out.length; i += 1) {
    // OpenCV's fixed-point BGR2GRAY, so engine B sees the same gray levels as mekss-anpr.
    out[i] = (img.data[i * 3] * 4899 + img.data[i * 3 + 1] * 9617 + img.data[i * 3 + 2] * 1868 + 8192) >> 14;
  }
  return out;
}

/** Platrix CRNN preprocessing (exact port of mekss-anpr `prep_crnn`). */
export async function prepCrnn(img: RgbImage): Promise<Float32Array> {
  return prepCrnnGray({ data: toGray(img), width: img.width, height: img.height }, CRNN_W, CRNN_H);
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  gray.forEach((v) => {
    hist[v] += 1;
  });
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Estimate text skew (degrees) by maximising the variance of the sheared row profile. */
export function estimateSkew(gray: Uint8Array, width: number, height: number): number {
  const thr = otsuThreshold(gray);
  const ink: Array<[number, number]> = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) if (gray[y * width + x] < thr) ink.push([x, y]);
  }
  if (ink.length < 50) return 0;
  let bestAngle = 0;
  let bestScore = -Infinity;
  for (let deg = -12; deg <= 12; deg += 1) {
    const tan = Math.tan((deg * Math.PI) / 180);
    const rows = new Float64Array(height * 2 + 1);
    for (const [x, y] of ink) {
      const yy = Math.round(y - (x - width / 2) * tan) + Math.floor(height / 2);
      if (yy >= 0 && yy < rows.length) rows[yy] += 1;
    }
    let mean = 0;
    rows.forEach((v) => {
      mean += v;
    });
    mean /= rows.length;
    let variance = 0;
    rows.forEach((v) => {
      variance += (v - mean) ** 2;
    });
    if (variance > bestScore) {
      bestScore = variance;
      bestAngle = deg;
    }
  }
  return bestAngle;
}

export async function deskew(img: RgbImage): Promise<RgbImage | null> {
  const angle = estimateSkew(toGray(img), img.width, img.height);
  if (Math.abs(angle) < 2) return null;
  const { data, info } = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } })
    .rotate(angle, { background: { r: 128, g: 128, b: 128 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rotated = { data, width: info.width, height: info.height };
  return cropRgb(rotated, {
    x: (info.width - img.width) / 2,
    y: (info.height - img.height) / 2,
    w: img.width,
    h: img.height,
  });
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 30;
    if (h < 0) h += 180;
  }
  const s = max ? (d / max) * 255 : 0;
  return [h, s, max];
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/** Same thresholds as mekss-anpr color.py (OpenCV HSV scale: H 0-180, S/V 0-255). */
export function classifyPlateColor(img: RgbImage): string {
  const x0 = Math.floor(img.width * 0.14);
  const x1 = Math.floor(img.width * 0.95);
  const y0 = Math.floor(img.height * 0.15);
  const y1 = Math.floor(img.height * 0.85);
  const pixels: Array<[number, number, number]> = [];
  const step = Math.max(1, Math.floor(((x1 - x0) * (y1 - y0)) / 4000));
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      n += 1;
      if (n % step) continue;
      const i = (y * img.width + x) * 3;
      pixels.push(rgbToHsv(img.data[i], img.data[i + 1], img.data[i + 2]));
    }
  }
  if (!pixels.length) return 'unknown';
  // Background covers most of the body on every plate type, so whole-body medians describe it.
  const sat = median(pixels.map((p) => p[1]));
  const val = median(pixels.map((p) => p[2]));
  // Bright pastel = white plate under a colour cast.
  const colored = sat >= 90 || (sat >= 55 && val <= 200);
  if (!colored) return val > 110 ? 'white' : 'unknown';
  const hues = pixels.filter((p) => p[1] >= 55).map((p) => p[0]);
  if (!hues.length) return 'unknown';
  // Vote over hue bins instead of a median: red wraps around 0/180.
  const bins: Array<[string, (h: number) => boolean]> = [
    ['yellow', (h) => h >= 15 && h <= 38],
    ['red', (h) => h < 9 || h > 165],
    ['green', (h) => h >= 40 && h <= 88],
    ['blue', (h) => h >= 90 && h <= 130],
  ];
  const [name, count] = bins
    .map(([n, test]) => [n, hues.filter(test).length] as const)
    .reduce((a, b) => (b[1] > a[1] ? b : a));
  return count > 0.5 * hues.length ? name : 'unknown';
}

const COLOR_TYPE_HINTS: Record<string, string[]> = {
  yellow: ['TAXI', 'PUBLIC'],
  red: ['GOVERNMENT'],
  green: ['POLICE', 'MILITARY'],
  blue: ['MILITARY', 'OTHER'],
  white: ['PRIVATE', 'DISABLED', 'AGRICULTURAL', 'FREE_ZONE', 'OTHER'],
};

export function colorConflicts(color: string, plateType: string | null): boolean {
  if (!plateType || color === 'unknown') return false;
  const hints = COLOR_TYPE_HINTS[color];
  return Boolean(hints) && !hints.includes(plateType);
}
