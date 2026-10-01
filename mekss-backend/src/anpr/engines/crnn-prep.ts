/**
 * Pure-TypeScript port of mekss-anpr's `prep_crnn` (OpenCV): cubic upscale to 40 px,
 * bilateral(5, 45, 45), CLAHE(2.0, 8x8), unsharp 1.4/-0.4 with Gaussian sigma 1, INTER_AREA
 * resize to 128x32. libvips equivalents (median, hist_local, reduce) shift the
 * pixel statistics enough to cost the CRNN several characters per plate, so the
 * OpenCV algorithms are reproduced here, including their border rules. Twin of the
 * PWA's `src/utils/iranPlateOcr/crnnPrep.js`; both are tested against
 * `shared/anpr/crnn-prep.opencv.json`.
 */

export interface GrayImage {
  data: Uint8Array;
  width: number;
  height: number;
}

/** saturate_cast<uchar>: cvRound rounds exact halves to even. */
function clampByte(v: number): number {
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  const f = Math.floor(v);
  const d = v - f;
  return d > 0.5 || (d === 0.5 && f % 2 === 1) ? f + 1 : f;
}
const clampIndex = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);

/** OpenCV BORDER_REFLECT_101 (gfedcb|abcdefgh|gfedcba). */
function reflect101(i: number, n: number): number {
  if (n === 1) return 0;
  let p = i;
  while (p < 0 || p >= n) p = p < 0 ? -p : 2 * n - 2 - p;
  return p;
}

function cubicWeights(x: number): [number, number, number, number] {
  const A = -0.75;
  const c0 = ((A * (x + 1) - 5 * A) * (x + 1) + 8 * A) * (x + 1) - 4 * A;
  const c1 = ((A + 2) * x - (A + 3)) * x * x + 1;
  const c2 = ((A + 2) * (1 - x) - (A + 3)) * (1 - x) * (1 - x) + 1;
  return [c0, c1, c2, 1 - c0 - c1 - c2];
}

/** cv2.resize(..., INTER_CUBIC) for 8-bit gray (replicated borders, half-pixel centres). */
export function resizeCubic(src: GrayImage, width: number, height: number): GrayImage {
  const sx = src.width / width;
  const sy = src.height / height;
  const xTaps = Array.from({ length: width }, (_, dx) => {
    const fx = (dx + 0.5) * sx - 0.5;
    const ix = Math.floor(fx);
    return { ix, w: cubicWeights(fx - ix) };
  });
  const tmp = new Float32Array(width * src.height);
  for (let y = 0; y < src.height; y += 1) {
    const row = y * src.width;
    for (let dx = 0; dx < width; dx += 1) {
      const { ix, w } = xTaps[dx];
      let acc = 0;
      for (let k = 0; k < 4; k += 1) acc += w[k] * src.data[row + clampIndex(ix - 1 + k, src.width)];
      tmp[y * width + dx] = acc;
    }
  }
  const out = new Uint8Array(width * height);
  for (let dy = 0; dy < height; dy += 1) {
    const fy = (dy + 0.5) * sy - 0.5;
    const iy = Math.floor(fy);
    const w = cubicWeights(fy - iy);
    for (let dx = 0; dx < width; dx += 1) {
      let acc = 0;
      for (let k = 0; k < 4; k += 1) acc += w[k] * tmp[clampIndex(iy - 1 + k, src.height) * width + dx];
      out[dy * width + dx] = clampByte(acc);
    }
  }
  return { data: out, width, height };
}

type Taps = Array<Array<[number, number]>>;

/** Box-overlap weights (OpenCV's INTER_AREA when both axes shrink). */
function boxTaps(srcLen: number, dstLen: number): Taps {
  const scale = srcLen / dstLen;
  return Array.from({ length: dstLen }, (_, d) => {
    const start = d * scale;
    const end = Math.min(srcLen, (d + 1) * scale);
    const taps: Array<[number, number]> = [];
    for (let s = Math.floor(start); s < end; s += 1) {
      const overlap = Math.min(end, s + 1) - Math.max(start, s);
      if (overlap > 1e-9) taps.push([s, overlap / scale]);
    }
    return taps;
  });
}

/** OpenCV's INTER_AREA fallback when any axis enlarges: 2-tap weights from pixel-edge overlap. */
function areaLinearTaps(srcLen: number, dstLen: number): Taps {
  const scale = srcLen / dstLen;
  return Array.from({ length: dstLen }, (_, d) => {
    let s = Math.floor(d * scale);
    let f = d + 1 - (s + 1) / scale;
    f = f <= 0 ? 0 : f - Math.floor(f);
    if (s >= srcLen - 1) {
      s = srcLen - 1;
      f = 0;
    }
    return f > 0 ? [[s, 1 - f], [s + 1, f]] : [[s, 1]];
  });
}

/** cv2.resize(..., INTER_AREA) for 8-bit gray. */
export function resizeArea(src: GrayImage, width: number, height: number): GrayImage {
  const shrinking = src.width >= width && src.height >= height;
  const taps = shrinking ? boxTaps : areaLinearTaps;
  const xt = taps(src.width, width);
  const yt = taps(src.height, height);
  const tmp = new Float32Array(width * src.height);
  for (let y = 0; y < src.height; y += 1) {
    const row = y * src.width;
    for (let dx = 0; dx < width; dx += 1) {
      let acc = 0;
      for (const [s, w] of xt[dx]) acc += w * src.data[row + s];
      tmp[y * width + dx] = acc;
    }
  }
  const out = new Uint8Array(width * height);
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      let acc = 0;
      for (const [s, w] of yt[dy]) acc += w * tmp[s * width + dx];
      out[dy * width + dx] = clampByte(acc);
    }
  }
  return { data: out, width, height };
}

/** cv2.bilateralFilter(gray, d, sigmaColor, sigmaSpace) with a circular window. */
export function bilateral(src: GrayImage, d: number, sigmaColor: number, sigmaSpace: number): GrayImage {
  const radius = Math.floor(d / 2);
  const colorCoeff = -0.5 / (sigmaColor * sigmaColor);
  const spaceCoeff = -0.5 / (sigmaSpace * sigmaSpace);
  const colorWeight = Float32Array.from({ length: 256 }, (_, i) => Math.exp(i * i * colorCoeff));
  const offsets: Array<[number, number, number]> = [];
  for (let i = -radius; i <= radius; i += 1) {
    for (let j = -radius; j <= radius; j += 1) {
      const r = Math.sqrt(i * i + j * j);
      if (r <= radius) offsets.push([i, j, Math.fround(Math.exp(r * r * spaceCoeff))]);
    }
  }
  const { width, height, data } = src;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const centre = data[y * width + x];
      let sum = 0;
      let wsum = 0;
      for (const [i, j, ws] of offsets) {
        const v = data[reflect101(y + i, height) * width + reflect101(x + j, width)];
        const w = ws * colorWeight[Math.abs(v - centre)];
        sum += v * w;
        wsum += w;
      }
      // OpenCV's 8-bit bilateral truncates instead of rounding.
      out[y * width + x] = Math.min(255, Math.floor(sum / wsum));
    }
  }
  return { data: out, width, height };
}

/** cv2.createCLAHE(clipLimit, (tiles, tiles)).apply(gray), including OpenCV's padding quirk. */
export function clahe(src: GrayImage, clipLimit = 2.0, tilesX = 8, tilesY = 8): GrayImage {
  const { width, height } = src;
  const divisible = width % tilesX === 0 && height % tilesY === 0;
  const extW = divisible ? width : width + tilesX - (width % tilesX);
  const extH = divisible ? height : height + tilesY - (height % tilesY);
  const tileW = extW / tilesX;
  const tileH = extH / tilesY;
  const tileArea = tileW * tileH;
  const clip = clipLimit > 0 ? Math.max(1, Math.floor((clipLimit * tileArea) / 256)) : 0;
  const lutScale = Math.fround(255 / tileArea);
  const luts = new Uint8Array(tilesX * tilesY * 256);
  const hist = new Int32Array(256);
  for (let ty = 0; ty < tilesY; ty += 1) {
    for (let tx = 0; tx < tilesX; tx += 1) {
      hist.fill(0);
      for (let y = ty * tileH; y < (ty + 1) * tileH; y += 1) {
        const row = reflect101(y, height) * width;
        for (let x = tx * tileW; x < (tx + 1) * tileW; x += 1) hist[src.data[row + reflect101(x, width)]] += 1;
      }
      if (clip > 0) {
        let clipped = 0;
        for (let i = 0; i < 256; i += 1) {
          if (hist[i] > clip) {
            clipped += hist[i] - clip;
            hist[i] = clip;
          }
        }
        const batch = Math.floor(clipped / 256);
        let residual = clipped - batch * 256;
        for (let i = 0; i < 256; i += 1) hist[i] += batch;
        if (residual > 0) {
          const step = Math.max(Math.floor(256 / residual), 1);
          for (let i = 0; i < 256 && residual > 0; i += step, residual -= 1) hist[i] += 1;
        }
      }
      const base = (ty * tilesX + tx) * 256;
      let sum = 0;
      for (let i = 0; i < 256; i += 1) {
        sum += hist[i];
        luts[base + i] = clampByte(Math.fround(sum * lutScale));
      }
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const tyf = Math.fround(Math.fround(y * Math.fround(1 / tileH)) - 0.5);
    const ty0 = Math.floor(tyf);
    const ya = tyf - ty0;
    const ty1 = Math.max(ty0, 0);
    const ty2 = Math.min(ty0 + 1, tilesY - 1);
    for (let x = 0; x < width; x += 1) {
      const txf = Math.fround(Math.fround(x * Math.fround(1 / tileW)) - 0.5);
      const tx0 = Math.floor(txf);
      const xa = txf - tx0;
      const tx1 = Math.max(tx0, 0);
      const tx2 = Math.min(tx0 + 1, tilesX - 1);
      const v = src.data[y * width + x];
      const lut = (tyi: number, txi: number) => luts[(tyi * tilesX + txi) * 256 + v];
      const top = lut(ty1, tx1) * (1 - xa) + lut(ty1, tx2) * xa;
      const bottom = lut(ty2, tx1) * (1 - xa) + lut(ty2, tx2) * xa;
      out[y * width + x] = clampByte(top * (1 - ya) + bottom * ya);
    }
  }
  return { data: out, width, height };
}

/** cv2.GaussianBlur(gray, (0, 0), sigma) for 8-bit input (kernel size round(6 sigma + 1) | 1). */
export function gaussianBlur(src: GrayImage, sigma: number): GrayImage {
  const size = Math.round(sigma * 6 + 1) | 1;
  const half = (size - 1) / 2;
  const kernel = Array.from({ length: size }, (_, i) => Math.exp(-((i - half) ** 2) / (2 * sigma * sigma)));
  const norm = kernel.reduce((a, b) => a + b, 0);
  for (let i = 0; i < size; i += 1) kernel[i] /= norm;
  const { width, height, data } = src;
  const tmp = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let acc = 0;
      for (let k = 0; k < size; k += 1) acc += kernel[k] * data[y * width + reflect101(x + k - half, width)];
      tmp[y * width + x] = acc;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let acc = 0;
      for (let k = 0; k < size; k += 1) acc += kernel[k] * tmp[reflect101(y + k - half, height) * width + x];
      out[y * width + x] = clampByte(acc);
    }
  }
  return { data: out, width, height };
}

/** Full Platrix CRNN transform; returns the [h, w] tensor scaled to 0..1. */
export function prepCrnnGray(gray: GrayImage, outW: number, outH: number): Float32Array {
  let img = gray;
  if (img.height < 40) {
    img = resizeCubic(img, Math.max(1, Math.floor(img.width * (40 / img.height))), 40);
  }
  img = bilateral(img, 5, 45, 45);
  img = clahe(img, 2.0, 8, 8);
  const blurred = gaussianBlur(img, 1.0);
  const sharpened = new Uint8Array(img.data.length);
  for (let i = 0; i < sharpened.length; i += 1) sharpened[i] = clampByte(1.4 * img.data[i] - 0.4 * blurred.data[i]);
  const resized = resizeArea({ data: sharpened, width: img.width, height: img.height }, outW, outH);
  const tensor = new Float32Array(outW * outH);
  for (let i = 0; i < tensor.length; i += 1) tensor[i] = resized.data[i] / 255;
  return tensor;
}
