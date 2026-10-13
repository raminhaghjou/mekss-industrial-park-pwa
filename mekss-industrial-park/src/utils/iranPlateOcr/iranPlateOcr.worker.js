/* eslint-disable no-restricted-globals */
/**
 * Web Worker — on-device Iranian plate OCR (Platrix YOLO + CRNN via onnxruntime-web).
 * Used when the server engines are unreachable and as a second opinion for still photos.
 * Everything is self-hosted on this origin: ORT WASM under /ort/ (copied from node_modules at
 * build time) and models under /models/iran-plate/ (runtime-cached by the service worker), so it
 * keeps working without internet access.
 */
import * as ort from 'onnxruntime-web/wasm';
import {
  cropEnhanceToCrnnTensor,
  cropImageData,
  guidedPlateBox,
  letterboxRgbToYoloTensor,
  mergeBoxes,
  parseYoloPlates,
  tileWindows,
} from './plateOcrCore.js';
import { constrainedBeamSearch, softmaxRows } from './plateDecoder.js';
import { iranPlateTypeOf } from '../iranLicensePlate.js';

const DEFAULT_MODEL_BASE = '/models/iran-plate';
/**
 * Same strategy as mekss-anpr: live frames are the guide-box ROI (416, retry 640); still photos are
 * full scenes where the plate is small (640, 960, then 2×2 tiles at 640 with a lower threshold).
 */
const MODES = {
  live: { sizes: [416, 640], conf: 0.22, tiles: false, maxBoxes: 2, tta: true },
  photo: { sizes: [640, 960], conf: 0.15, tiles: true, maxBoxes: 5, tta: true },
};
const TILE_MIN_SIDE = 800;
let fixedSize = null;

ort.env.wasm.wasmPaths = '/ort/';
ort.env.wasm.simd = true;
// SharedArrayBuffer (threads) is only available on cross-origin-isolated pages.
ort.env.wasm.numThreads = self.crossOriginIsolated
  ? Math.max(1, Math.min(4, (self.navigator?.hardwareConcurrency || 2) - 1))
  : 1;
ort.env.wasm.proxy = false;

let yoloSession = null;
let crnnSession = null;
let labels = null;
let loading = null;

function post(type, id, payload = {}) {
  self.postMessage({ type, id, ...payload });
}

async function fetchModel(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`مدل ${url.split('/').pop()} روی سرور موجود نیست (HTTP ${res.status})`);
  return res.arrayBuffer();
}

async function ensureModels(id, modelBase = DEFAULT_MODEL_BASE) {
  if (yoloSession && crnnSession && labels) return;
  if (!loading) {
    loading = (async () => {
      post('progress', id, { stage: 'load', message: 'بارگذاری مدل تشخیص پلاک روی دستگاه…' });
      const labelsRes = await fetch(`${modelBase}/ocr_crnn.labels.json`, { cache: 'force-cache' });
      if (!labelsRes.ok) throw new Error('labels.json یافت نشد — اسکریپت models:iran-plate را اجرا کنید');
      labels = await labelsRes.json();
      const options = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
      const [yoloBuf, crnnBuf] = await Promise.all([
        fetchModel(`${modelBase}/plate_yolo.onnx`),
        fetchModel(`${modelBase}/ocr_crnn.onnx`),
      ]);
      yoloSession = await ort.InferenceSession.create(yoloBuf, options);
      crnnSession = await ort.InferenceSession.create(crnnBuf, options);
      post('progress', id, { stage: 'ready', message: 'مدل‌ها آماده است', threads: ort.env.wasm.numThreads });
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  await loading;
}

function imageDataFromBitmap(bitmap) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

async function readCrop(imageData, box) {
  const { tensor } = cropEnhanceToCrnnTensor(imageData, box);
  const out = await crnnSession.run({ [crnnSession.inputNames[0]]: new ort.Tensor('float32', tensor, [1, 1, 32, 128]) });
  const logits = out[crnnSession.outputNames[0]];
  const [, timeSteps, classCount] = logits.dims;
  const probs = softmaxRows(logits.data, timeSteps, classCount);
  return constrainedBeamSearch(probs, timeSteps, labels);
}

/** Runs the detector at one size; returns null when this export rejects the size (fixed-input model). */
async function detectAt(imageData, size, conf) {
  const meta = letterboxRgbToYoloTensor(imageData, size);
  try {
    const out = await yoloSession.run({
      [yoloSession.inputNames[0]]: new ort.Tensor('float32', meta.tensor, [1, 3, size, size]),
    });
    return parseYoloPlates(out[yoloSession.outputNames[0]], meta, { confThreshold: conf, iouThreshold: 0.4 });
  } catch (error) {
    if (size === 640) throw error;
    fixedSize = 640;
    return null;
  }
}

async function detect(imageData, cfg) {
  const sizes = fixedSize ? [fixedSize] : cfg.sizes;
  for (const size of sizes) {
    const boxes = await detectAt(imageData, size, cfg.conf);
    if (boxes?.length) return boxes;
  }
  if (!cfg.tiles || Math.max(imageData.width, imageData.height) < TILE_MIN_SIDE) return [];
  const found = [];
  for (const win of tileWindows(imageData.width, imageData.height)) {
    const boxes = await detectAt(cropImageData(imageData, win), fixedSize || 640, cfg.conf);
    for (const box of boxes || []) found.push({ ...box, x: box.x + win.x, y: box.y + win.y });
  }
  return mergeBoxes(found);
}

const clampBox = (variant, imageData, conf) => {
  const x = Math.max(0, Math.floor(variant.x));
  const y = Math.max(0, Math.floor(variant.y));
  return {
    x,
    y,
    w: Math.max(1, Math.min(imageData.width - x, Math.ceil(variant.w))),
    h: Math.max(1, Math.min(imageData.height - y, Math.ceil(variant.h))),
    conf,
  };
};

async function recognize(imageData, mode, id) {
  await ensureModels(id);
  const cfg = MODES[mode] || MODES.live;
  let boxes = await detect(imageData, cfg);
  const detectorHits = boxes.length;
  if (!boxes.length) boxes = [guidedPlateBox(imageData.width, imageData.height)];
  post('progress', id, { stage: 'ocr', message: 'خواندن پلاک…' });

  let best = null;
  for (const box of boxes.slice(0, cfg.maxBoxes)) {
    // Light TTA: detector box plus a slightly wider crop; keep whichever decodes more confidently.
    const wider = { ...box, x: box.x - box.w * 0.04, w: box.w * 1.08, y: box.y - box.h * 0.08, h: box.h * 1.16 };
    for (const variant of cfg.tta ? [box, wider] : [box]) {
      const clamped = clampBox(variant, imageData, box.conf);
      const decoded = await readCrop(imageData, clamped);
      const score = (decoded.valid ? 1 : 0) + decoded.probability;
      if (!best || score > best.score) best = { score, decoded, box: clamped };
    }
    if (best?.decoded.valid && best.decoded.probability >= 0.9) break;
  }

  const d = best?.decoded;
  return {
    raw: d?.raw || '',
    plate: d?.valid ? d.plate : '',
    valid: Boolean(d?.valid),
    confidence: Number((d?.valid ? d.probability : d?.rawConfidence || 0).toFixed(3)),
    charConfidences: d?.charConfidences || [],
    positions: d?.positions || [],
    alternatives: d?.alternatives || [],
    plateType: d?.valid ? iranPlateTypeOf(d.plate) : null,
    box: best?.box || null,
    detectorHits,
    mode,
    imageSize: { w: imageData.width, h: imageData.height },
  };
}

self.onmessage = async (event) => {
  const { type, id, bitmap, image, mode, modelBase } = event.data || {};
  try {
    if (type === 'init') {
      await ensureModels(id, modelBase);
      post('inited', id);
      return;
    }
    if (type === 'recognize') {
      let imageData = image || null;
      if (!imageData && bitmap) {
        try {
          imageData = imageDataFromBitmap(bitmap);
        } finally {
          bitmap.close?.();
        }
      }
      if (!imageData?.width) throw new Error('تصویر خالی است');
      const result = await recognize(imageData, mode, id);
      post('result', id, { result });
    }
  } catch (error) {
    post('error', id, { message: error?.message || 'خطای OCR پلاک' });
  }
};
