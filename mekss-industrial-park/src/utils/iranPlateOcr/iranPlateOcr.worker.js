/* eslint-disable no-restricted-globals */
/**
 * Web Worker — Iranian plate OCR (Platrix YOLO + CRNN via onnxruntime-web).
 * Runs off the UI thread so mobile/desktop browsers stay responsive.
 */
import * as ort from 'onnxruntime-web';
import {
  ctcGreedyDecode,
  cropEnhanceToCrnnTensor,
  guidedPlateBox,
  letterboxRgbToYoloTensor,
  normalizeIranPlateOcr,
  parseYoloPlates,
} from './plateOcrCore.js';

const MODEL_BASE = '/models/iran-plate';
const HF_BASE = 'https://huggingface.co/Dibachain/Platrix/resolve/main';

ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;
// Load WASM from npm package CDN so Vite/worker bundling stays simple.
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';

let yoloSession = null;
let crnnSession = null;
let labels = null;
let ready = false;
let activeId = null;

function post(type, payload = {}) {
  self.postMessage({ type, id: activeId, ...payload });
}

async function fetchArrayBuffer(urls) {
  let lastError;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.arrayBuffer();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Model download failed');
}

async function ensureModels() {
  if (ready) return;
  post('progress', { stage: 'load', message: 'بارگذاری مدل تشخیص پلاک…' });

  const labelsRes = await fetch(`${MODEL_BASE}/ocr_crnn.labels.json`, { cache: 'force-cache' });
  if (!labelsRes.ok) throw new Error('labels.json یافت نشد — اسکریپت download-iran-plate-models را اجرا کنید');
  labels = await labelsRes.json();

  post('progress', { stage: 'load', message: 'بارگذاری مدل YOLO…' });
  const yoloBuf = await fetchArrayBuffer([
    `${MODEL_BASE}/plate_yolo.onnx`,
    `${HF_BASE}/plate_yolo.onnx`,
  ]);
  yoloSession = await ort.InferenceSession.create(yoloBuf, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });

  post('progress', { stage: 'load', message: 'بارگذاری مدل OCR…' });
  const crnnBuf = await fetchArrayBuffer([
    `${MODEL_BASE}/ocr_crnn.onnx`,
    `${HF_BASE}/ocr_crnn.onnx`,
  ]);
  crnnSession = await ort.InferenceSession.create(crnnBuf, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });

  ready = true;
  post('ready', { message: 'مدل‌ها آماده است' });
}

function imageDataFromBitmap(bitmap) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

async function recognize(imageBitmap, requestId) {
  await ensureModels();
  post('progress', { id: requestId, stage: 'detect', message: 'جست‌وجوی پلاک در تصویر…' });

  const imageData = imageDataFromBitmap(imageBitmap);
  try {
    imageBitmap.close?.();
  } catch {
    /* ignore */
  }

  const meta = letterboxRgbToYoloTensor(imageData, 640);
  const yoloInput = new ort.Tensor('float32', meta.tensor, [1, 3, 640, 640]);
  const yoloOut = await yoloSession.run({ images: yoloInput });
  const output0 = yoloOut.output0;
  let boxes = parseYoloPlates(output0, meta, { confThreshold: 0.22, iouThreshold: 0.4 });

  if (!boxes.length) {
    boxes = [guidedPlateBox(imageData.width, imageData.height)];
    post('progress', { id: requestId, stage: 'detect', message: 'پلاک با راهنما برش شد…' });
  } else {
    post('progress', { id: requestId, stage: 'ocr', message: 'خواندن پلاک…' });
  }

  const attempts = [];
  for (const box of boxes.slice(0, 3)) {
    const { tensor } = cropEnhanceToCrnnTensor(imageData, box);
    const crnnInput = new ort.Tensor('float32', tensor, [1, 1, 32, 128]);
    const crnnOut = await crnnSession.run({ input: crnnInput });
    const logits = crnnOut.logits;
    const [, timeSteps, classCount] = logits.dims;
    const decoded = ctcGreedyDecode(logits.data, timeSteps, classCount, labels);
    const normalized = normalizeIranPlateOcr(decoded.raw);
    attempts.push({
      raw: decoded.raw,
      plate: normalized.plate,
      valid: normalized.valid,
      confidence: Number((decoded.confidence * (box.conf || 0.55)).toFixed(3)),
      box,
    });
    if (normalized.valid) break;
  }

  attempts.sort((a, b) => Number(b.valid) - Number(a.valid) || b.confidence - a.confidence);
  const best = attempts[0] || { raw: '', plate: '', valid: false, confidence: 0 };

  return {
    ...best,
    attempts: attempts.length,
    detectorHits: boxes.filter((b) => b.conf > 0).length,
  };
}

self.onmessage = async (event) => {
  const { type, id, bitmap } = event.data || {};
  try {
    if (type === 'init') {
      await ensureModels();
      post('inited', { id });
      return;
    }
    if (type === 'recognize') {
      if (!bitmap) throw new Error('تصویر خالی است');
      const result = await recognize(bitmap, id);
      post('result', { id, result });
    }
  } catch (error) {
    post('error', {
      id,
      message: error?.message || 'خطای OCR پلاک',
    });
  }
};
