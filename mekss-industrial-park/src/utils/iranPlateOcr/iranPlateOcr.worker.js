/* eslint-disable no-restricted-globals */
/**
 * Web Worker — on-device Iranian plate OCR (Platrix YOLO + CRNN via onnxruntime-web).
 * Only used when the server engines are unreachable. Everything is self-hosted on this origin:
 * ORT WASM under /ort/ (copied from node_modules at build time) and models under /models/iran-plate/
 * (runtime-cached by the service worker), so it keeps working without internet access.
 */
import * as ort from 'onnxruntime-web';
import {
  cropEnhanceToCrnnTensor,
  guidedPlateBox,
  letterboxRgbToYoloTensor,
  parseYoloPlates,
} from './plateOcrCore.js';
import { constrainedBeamSearch, softmaxRows } from './plateDecoder.js';
import { iranPlateTypeOf } from '../iranLicensePlate.js';

const DEFAULT_MODEL_BASE = '/models/iran-plate';
const YOLO_SIZE = 640;

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
let activeId = null;

function post(type, payload = {}) {
  self.postMessage({ type, id: activeId, ...payload });
}

async function fetchModel(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`مدل ${url.split('/').pop()} روی سرور موجود نیست (HTTP ${res.status})`);
  return res.arrayBuffer();
}

async function ensureModels(modelBase = DEFAULT_MODEL_BASE) {
  if (yoloSession && crnnSession && labels) return;
  if (!loading) {
    loading = (async () => {
      post('progress', { stage: 'load', message: 'بارگذاری مدل تشخیص پلاک روی دستگاه…' });
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
      post('ready', { message: 'مدل‌ها آماده است', threads: ort.env.wasm.numThreads });
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

async function recognize(imageBitmap, requestId) {
  await ensureModels();
  const imageData = imageDataFromBitmap(imageBitmap);
  try {
    imageBitmap.close?.();
  } catch {
    /* ignore */
  }

  const meta = letterboxRgbToYoloTensor(imageData, YOLO_SIZE);
  const yoloOut = await yoloSession.run({
    [yoloSession.inputNames[0]]: new ort.Tensor('float32', meta.tensor, [1, 3, YOLO_SIZE, YOLO_SIZE]),
  });
  let boxes = parseYoloPlates(yoloOut[yoloSession.outputNames[0]], meta, { confThreshold: 0.22, iouThreshold: 0.4 });
  const detectorHits = boxes.length;
  if (!boxes.length) boxes = [guidedPlateBox(imageData.width, imageData.height)];
  post('progress', { id: requestId, stage: 'ocr', message: 'خواندن پلاک…' });

  let best = null;
  for (const box of boxes.slice(0, 2)) {
    // Light TTA: detector box plus a slightly wider crop; keep whichever decodes more confidently.
    const wider = { ...box, x: box.x - box.w * 0.04, w: box.w * 1.08, y: box.y - box.h * 0.08, h: box.h * 1.16 };
    for (const variant of [box, wider]) {
      const clamped = {
        x: Math.max(0, Math.floor(variant.x)),
        y: Math.max(0, Math.floor(variant.y)),
        w: Math.max(1, Math.min(imageData.width - Math.max(0, Math.floor(variant.x)), Math.ceil(variant.w))),
        h: Math.max(1, Math.min(imageData.height - Math.max(0, Math.floor(variant.y)), Math.ceil(variant.h))),
        conf: box.conf,
      };
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
  };
}

self.onmessage = async (event) => {
  const { type, id, bitmap, modelBase } = event.data || {};
  activeId = id;
  try {
    if (type === 'init') {
      await ensureModels(modelBase);
      post('inited', { id });
      return;
    }
    if (type === 'recognize') {
      if (!bitmap) throw new Error('تصویر خالی است');
      const result = await recognize(bitmap, id);
      post('result', { id, result });
    }
  } catch (error) {
    post('error', { id, message: error?.message || 'خطای OCR پلاک' });
  }
};
