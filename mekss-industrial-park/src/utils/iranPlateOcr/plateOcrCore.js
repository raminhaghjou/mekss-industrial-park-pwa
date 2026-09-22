/**
 * Iranian plate OCR utilities — normalize Platrix CRNN output to MEKSS canonical form.
 * Canonical: `12ب34567` (2 digits + letter + 3 digits + 2 region digits).
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const LETTER_ALIASES = {
  آ: 'ا',
  أ: 'ا',
  إ: 'ا',
  ٱ: 'ا',
  الف: 'ا',
  ی: 'ی',
  ي: 'ی',
  ك: 'ک',
  ۀ: 'ه',
  ه: 'ه',
};

export function toAsciiDigits(value = '') {
  return String(value)
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/**
 * Greedy CTC decode — matches Platrix reference.
 * @param {Float32Array|number[]} logits flat or nested T×(C+1)
 * @param {number} timeSteps
 * @param {number} classCount including blank
 * @param {string[]} labels
 */
export function ctcGreedyDecode(logits, timeSteps, classCount, labels) {
  const blank = labels.length;
  const ids = [];
  for (let t = 0; t < timeSteps; t += 1) {
    let best = 0;
    let bestScore = -Infinity;
    const offset = t * classCount;
    for (let c = 0; c < classCount; c += 1) {
      const score = logits[offset + c];
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    ids.push(best);
  }

  const out = [];
  let prev = -1;
  let confSum = 0;
  let confCount = 0;
  for (let t = 0; t < ids.length; t += 1) {
    const i = ids[t];
    if (i !== blank && i !== prev) {
      out.push(labels[i] ?? '');
      const offset = t * classCount;
      // softmax-ish confidence from max logit vs blank
      const maxLogit = logits[offset + i];
      confSum += 1 / (1 + Math.exp(-maxLogit));
      confCount += 1;
    }
    prev = i;
  }

  return {
    raw: out.join(''),
    confidence: confCount ? confSum / confCount : 0,
  };
}

/**
 * Parse OCR raw string into MEKSS plate parts when possible.
 * Accepts outputs like `12ب34567`, `۱۲ ب ۳۴۵ ۶۷`, `81و63813`.
 */
export function normalizeIranPlateOcr(raw = '') {
  let text = toAsciiDigits(raw)
    .replace(/ایران/gi, '')
    .replace(/IRAN/gi, '')
    .replace(/[\s\-_|./\\,:;]+/g, '');

  // Collapse multi-char letter aliases
  Object.entries(LETTER_ALIASES).forEach(([from, to]) => {
    if (from.length === 1) text = text.split(from).join(to);
  });

  // Extract: 2 digits, letter(s), 3 digits, 2 digits
  const match = text.match(/^(\d{2})([آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]+)(\d{3})(\d{2})$/u);
  if (!match) {
    return { plate: '', valid: false, parts: null, raw: text };
  }

  let letter = match[2];
  if (letter === 'آ' || letter === 'الف') letter = 'ا';
  if (letter.length > 1) {
    // Prefer first known single letter
    const known = [...letter].find((ch) => 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی'.includes(ch));
    letter = known || letter[0];
  }

  const plate = `${match[1]}${letter}${match[3]}${match[4]}`;
  return {
    plate,
    valid: true,
    parts: { series: match[1], letter, middle: match[3], region: match[4] },
    raw: text,
  };
}

/**
 * Letterbox RGB ImageData into 640×640 float CHW tensor /255.
 * Worker-safe (OffscreenCanvas only).
 */
export function letterboxRgbToYoloTensor(imageData, size = 640) {
  const { width: srcW, height: srcH, data } = imageData;
  const gain = Math.min(size / srcW, size / srcH);
  const newW = Math.round(srcW * gain);
  const newH = Math.round(srcH * gain);
  const padX = Math.floor((size - newW) / 2);
  const padY = Math.floor((size - newH) / 2);

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);

  const srcCanvas = new OffscreenCanvas(srcW, srcH);
  const sctx = srcCanvas.getContext('2d');
  sctx.putImageData(new ImageData(new Uint8ClampedArray(data), srcW, srcH), 0, 0);
  ctx.drawImage(srcCanvas, 0, 0, srcW, srcH, padX, padY, newW, newH);

  const out = ctx.getImageData(0, 0, size, size).data;
  const tensor = new Float32Array(1 * 3 * size * size);
  const plane = size * size;
  for (let i = 0; i < plane; i += 1) {
    tensor[i] = out[i * 4] / 255;
    tensor[plane + i] = out[i * 4 + 1] / 255;
    tensor[plane * 2 + i] = out[i * 4 + 2] / 255;
  }

  return { tensor, gain, padX, padY, srcW, srcH, size };
}

/**
 * Parse YOLO 1×5×N output → boxes in original image coords.
 */
export function parseYoloPlates(output, meta, { confThreshold = 0.25, iouThreshold = 0.45 } = {}) {
  const [, , n] = output.dims; // 1,5,N
  const data = output.data;
  const candidates = [];
  for (let i = 0; i < n; i += 1) {
    const cx = data[0 * n + i];
    const cy = data[1 * n + i];
    const w = data[2 * n + i];
    const h = data[3 * n + i];
    const conf = data[4 * n + i];
    if (conf < confThreshold) continue;
    candidates.push({ cx, cy, w, h, conf });
  }

  candidates.sort((a, b) => b.conf - a.conf);
  const kept = [];
  const iou = (a, b) => {
    const ax1 = a.cx - a.w / 2;
    const ay1 = a.cy - a.h / 2;
    const ax2 = a.cx + a.w / 2;
    const ay2 = a.cy + a.h / 2;
    const bx1 = b.cx - b.w / 2;
    const by1 = b.cy - b.h / 2;
    const bx2 = b.cx + b.w / 2;
    const by2 = b.cy + b.h / 2;
    const ix1 = Math.max(ax1, bx1);
    const iy1 = Math.max(ay1, by1);
    const ix2 = Math.min(ax2, bx2);
    const iy2 = Math.min(ay2, by2);
    const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
    const uni = a.w * a.h + b.w * b.h - inter;
    return uni > 0 ? inter / uni : 0;
  };

  for (const box of candidates) {
    if (kept.some((k) => iou(k, box) > iouThreshold)) continue;
    kept.push(box);
  }

  return kept.map((box) => {
    const x1 = (box.cx - box.w / 2 - meta.padX) / meta.gain;
    const y1 = (box.cy - box.h / 2 - meta.padY) / meta.gain;
    const x2 = (box.cx + box.w / 2 - meta.padX) / meta.gain;
    const y2 = (box.cy + box.h / 2 - meta.padY) / meta.gain;
    return {
      x: Math.max(0, Math.floor(x1)),
      y: Math.max(0, Math.floor(y1)),
      w: Math.max(1, Math.floor(Math.min(meta.srcW, x2) - Math.max(0, x1))),
      h: Math.max(1, Math.floor(Math.min(meta.srcH, y2) - Math.max(0, y1))),
      conf: box.conf,
    };
  });
}

/**
 * Crop ImageData region and enhance for CRNN (grayscale 128×32 /255).
 */
export function cropEnhanceToCrnnTensor(imageData, box) {
  const { width: srcW, height: srcH, data } = imageData;
  let { x, y, w, h } = box;
  // Pad crop slightly
  const pad = Math.round(Math.min(w, h) * 0.08);
  x = Math.max(0, x - pad);
  y = Math.max(0, y - pad);
  w = Math.min(srcW - x, w + pad * 2);
  h = Math.min(srcH - y, h + pad * 2);

  const crop = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row += 1) {
    for (let col = 0; col < w; col += 1) {
      const si = ((y + row) * srcW + (x + col)) * 4;
      const di = (row * w + col) * 4;
      crop[di] = data[si];
      crop[di + 1] = data[si + 1];
      crop[di + 2] = data[si + 2];
      crop[di + 3] = 255;
    }
  }

  // Contrast stretch on grayscale
  const gray = new Float32Array(w * h);
  let min = 255;
  let max = 0;
  for (let i = 0; i < w * h; i += 1) {
    const v = 0.299 * crop[i * 4] + 0.587 * crop[i * 4 + 1] + 0.114 * crop[i * 4 + 2];
    gray[i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = Math.max(1, max - min);
  for (let i = 0; i < gray.length; i += 1) {
    let v = ((gray[i] - min) / span) * 255;
    // mild sharpen via unsharp residual against neighbor average
    v = Math.min(255, Math.max(0, v * 1.15 - 19));
    gray[i] = v;
  }

  const outW = 128;
  const outH = 32;
  const tensor = new Float32Array(1 * 1 * outH * outW);
  for (let oy = 0; oy < outH; oy += 1) {
    for (let ox = 0; ox < outW; ox += 1) {
      const sx = Math.min(w - 1, Math.floor((ox + 0.5) * w / outW));
      const sy = Math.min(h - 1, Math.floor((oy + 0.5) * h / outH));
      tensor[oy * outW + ox] = gray[sy * w + sx] / 255;
    }
  }

  return { tensor, cropBox: { x, y, w, h } };
}

/** Guided center crop when detector finds nothing — uses middle band (plate guide). */
export function guidedPlateBox(srcW, srcH) {
  const w = Math.floor(srcW * 0.78);
  const h = Math.floor(srcH * 0.22);
  return {
    x: Math.floor((srcW - w) / 2),
    y: Math.floor(srcH * 0.42),
    w,
    h,
    conf: 0,
  };
}
