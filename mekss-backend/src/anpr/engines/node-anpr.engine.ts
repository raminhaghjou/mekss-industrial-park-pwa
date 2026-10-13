import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { InferenceSession, Tensor } from 'onnxruntime-node';
import { AnprEngine, EngineCandidate, EngineResult, EngineUnavailableError } from '../anpr.types';
import { DecodeResult, constrainedBeamSearch, mergeDecodes, softmaxRows } from '../ctc-decoder';
import { normalizePlate } from '../plate-grammar';
import {
  Box,
  CRNN_H,
  CRNN_W,
  RgbImage,
  classifyPlateColor,
  colorConflicts,
  cropRgb,
  decodeToRgb,
  deskew,
  letterboxTensor,
  padBox,
  prepCrnn,
  shiftVariants,
} from './node-image-ops';

type OrtModule = typeof import('onnxruntime-node');
type Detection = Box & { conf: number; source: string };

const EARLY_EXIT_PROBABILITY = 0.9;
const LOAD_RETRY_MS = 30_000;

export function decodeYolo(
  data: Float32Array,
  dims: readonly number[],
  meta: { ratio: number; padX: number; padY: number; width: number; height: number },
  confThreshold: number,
  iouThreshold: number,
): Detection[] {
  const [, channels, n] = dims;
  const boxes: Array<{ x1: number; y1: number; x2: number; y2: number; conf: number }> = [];
  for (let i = 0; i < n; i += 1) {
    let conf = 0;
    for (let c = 4; c < channels; c += 1) conf = Math.max(conf, data[c * n + i]);
    if (conf <= confThreshold) continue;
    const cx = data[i];
    const cy = data[n + i];
    const w = data[2 * n + i];
    const h = data[3 * n + i];
    boxes.push({
      x1: (cx - w / 2 - meta.padX) / meta.ratio,
      y1: (cy - h / 2 - meta.padY) / meta.ratio,
      x2: (cx + w / 2 - meta.padX) / meta.ratio,
      y2: (cy + h / 2 - meta.padY) / meta.ratio,
      conf,
    });
  }
  boxes.sort((a, b) => b.conf - a.conf);
  const kept: typeof boxes = [];
  const area = (b: (typeof boxes)[number]) => Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  for (const box of boxes) {
    const overlaps = kept.some((k) => {
      const iw = Math.max(0, Math.min(k.x2, box.x2) - Math.max(k.x1, box.x1));
      const ih = Math.max(0, Math.min(k.y2, box.y2) - Math.max(k.y1, box.y1));
      const inter = iw * ih;
      return inter / (area(k) + area(box) - inter + 1e-9) > iouThreshold;
    });
    if (!overlaps) kept.push(box);
  }
  return kept
    .map((b) => {
      const x1 = Math.max(0, Math.floor(b.x1));
      const y1 = Math.max(0, Math.floor(b.y1));
      const x2 = Math.min(meta.width, Math.floor(b.x2));
      const y2 = Math.min(meta.height, Math.floor(b.y2));
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, conf: b.conf, source: 'yolo' };
    })
    .filter((b) => b.w > 2 && b.h > 2);
}

export function guidedBoxes(width: number, height: number): Detection[] {
  const aspect = width / Math.max(1, height);
  if (aspect >= 2.5 && aspect <= 7) return [{ x: 0, y: 0, w: width, h: height, conf: 0, source: 'guided' }];
  const bw = Math.floor(width * 0.78);
  const bh = Math.floor(height * 0.22);
  return [{ x: Math.floor((width - bw) / 2), y: Math.floor(height * 0.39), w: bw, h: bh, conf: 0, source: 'guided' }];
}

/** Engine B: in-process fail-over engine (onnxruntime-node + sharp). */
@Injectable()
export class NodeAnprEngine implements AnprEngine {
  readonly name = 'node' as const;
  private readonly logger = new Logger(NodeAnprEngine.name);
  private readonly modelDir: string;
  private readonly detConf: number;
  private readonly maxSide: number;
  private readonly maxConcurrency: number;
  private readonly tta: boolean;
  private active = 0;
  private loading: Promise<void> | null = null;
  private loadError: Error | null = null;
  private loadErrorAt = 0;
  private ort: OrtModule | null = null;
  private detector: InferenceSession | null = null;
  private detectorFallback: InferenceSession | null = null;
  private recognizer: InferenceSession | null = null;
  private labels: string[] = [];
  private detectorSize = 416;
  private recognizerBatchable = false;

  constructor(config: ConfigService) {
    this.modelDir = config.get<string>('ANPR_MODEL_DIR') || join(process.cwd(), 'models', 'iran-plate');
    this.detConf = Number(config.get<string>('ANPR_DET_CONF', '0.25')) || 0.25;
    this.maxSide = Number(config.get<string>('ANPR_MAX_SIDE', '1280')) || 1280;
    this.maxConcurrency = Number(config.get<string>('ANPR_NODE_CONCURRENCY', '2')) || 2;
    this.tta = config.get<string>('ANPR_TTA', 'true') !== 'false';
  }

  private file(name: string) {
    return join(this.modelDir, name);
  }

  private async load(): Promise<void> {
    if (this.recognizer) return;
    if (this.loadError) {
      if (Date.now() - this.loadErrorAt < LOAD_RETRY_MS) throw this.loadError;
      this.loadError = null;
      this.loading = null;
    }
    if (!this.loading) {
      this.loading = (async () => {
        const required = ['plate_yolo.onnx', 'ocr_crnn.onnx', 'ocr_crnn.labels.json'];
        const missing = required.filter((f) => !existsSync(this.file(f)));
        if (missing.length) throw new EngineUnavailableError(`node engine models missing in ${this.modelDir}: ${missing.join(', ')}`, false);
        this.ort = await import('onnxruntime-node');
        const options: InferenceSession.SessionOptions = {
          graphOptimizationLevel: 'all',
          intraOpNumThreads: Number(process.env.ANPR_NODE_THREADS || 2),
          interOpNumThreads: 1,
          executionMode: 'sequential',
        };
        this.detector = await this.ort.InferenceSession.create(this.file('plate_yolo.onnx'), options);
        if (existsSync(this.file('plate_yolo_fallback.onnx'))) {
          this.detectorFallback = await this.ort.InferenceSession.create(this.file('plate_yolo_fallback.onnx'), options);
        }
        this.recognizer = await this.ort.InferenceSession.create(this.file('ocr_crnn.onnx'), options);
        this.labels = JSON.parse(readFileSync(this.file('ocr_crnn.labels.json'), 'utf8'));
        this.detectorSize = fixedSquare(this.detector) ?? 416;
        this.recognizerBatchable = true;
        this.logger.log(`Node ANPR engine loaded from ${this.modelDir}`);
      })().catch((error) => {
        this.loadError = error instanceof EngineUnavailableError ? error : new EngineUnavailableError(String(error?.message || error), false);
        this.loadErrorAt = Date.now();
        this.logger.warn(this.loadError.message);
        throw this.loadError;
      });
    }
    await this.loading;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.load();
      return true;
    } catch {
      return false;
    }
  }

  private async detect(img: RgbImage, session: InferenceSession, size: number, source: string): Promise<Detection[]> {
    const ort = this.ort as OrtModule;
    const lb = await letterboxTensor(img, size);
    const input = new ort.Tensor('float32', lb.tensor, [1, 3, size, size]);
    const out = await session.run({ [session.inputNames[0]]: input });
    const tensor = out[session.outputNames[0]] as Tensor;
    return decodeYolo(tensor.data as Float32Array, tensor.dims, { ...lb, width: img.width, height: img.height }, this.detConf, 0.45)
      .map((d) => ({ ...d, source }));
  }

  private async readCrops(crops: RgbImage[]): Promise<DecodeResult[]> {
    const ort = this.ort as OrtModule;
    const session = this.recognizer as InferenceSession;
    const tensors = await Promise.all(crops.map((c) => prepCrnn(c)));
    const decodeOne = (data: Float32Array, dims: readonly number[], offset: number) => {
      const [, timeSteps, classes] = dims;
      const slice = data.subarray(offset * timeSteps * classes, (offset + 1) * timeSteps * classes);
      return constrainedBeamSearch(softmaxRows(slice, timeSteps, classes), timeSteps, this.labels);
    };
    if (this.recognizerBatchable) {
      try {
        const batch = new Float32Array(tensors.length * CRNN_W * CRNN_H);
        tensors.forEach((t, i) => batch.set(t, i * CRNN_W * CRNN_H));
        const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', batch, [tensors.length, 1, CRNN_H, CRNN_W]) });
        const logits = out[session.outputNames[0]] as Tensor;
        return tensors.map((_, i) => decodeOne(logits.data as Float32Array, logits.dims, i));
      } catch {
        this.recognizerBatchable = false;
      }
    }
    const results: DecodeResult[] = [];
    for (const t of tensors) {
      const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', t, [1, 1, CRNN_H, CRNN_W]) });
      const logits = out[session.outputNames[0]] as Tensor;
      results.push(decodeOne(logits.data as Float32Array, logits.dims, 0));
    }
    return results;
  }

  private async readDetection(img: RgbImage, det: Detection): Promise<EngineCandidate> {
    const tight = cropRgb(img, det);
    const padded = cropRgb(img, padBox(det, img.width, img.height, 0.12));
    const rotated = await deskew(padded);
    const crops = [tight, ...(rotated ? [rotated] : []), ...(this.tta ? shiftVariants(tight) : [])];
    const decodes = await this.readCrops(crops);
    const merged = mergeDecodes(decodes) ?? decodes[0];
    const color = classifyPlateColor(rotated ?? tight);
    const normalized = merged.valid ? normalizePlate(merged.plate) : null;
    let plateType = normalized?.valid ? normalized.plateType : null;
    let partial: { number: string } | null = null;
    if (!merged.valid && /^\d{5}$/.test(merged.raw)) {
      plateType = 'FREE_ZONE';
      partial = { number: merged.raw };
    }
    return {
      bbox: { x: det.x, y: det.y, w: det.w, h: det.h },
      detConf: Number(det.conf.toFixed(4)),
      source: det.source,
      rectification: rotated ? 'deskew' : 'none',
      variants: crops.length,
      color,
      plateType,
      colorConflict: colorConflicts(color, plateType),
      plate: normalized?.valid ? normalized.plate : '',
      valid: Boolean(normalized?.valid),
      confidence: Number(merged.probability.toFixed(5)),
      charConfidences: merged.charConfidences.map((c) => Number(c.toFixed(4))),
      positions: merged.positions,
      alternatives: merged.alternatives,
      raw: merged.raw,
      rawConfidence: Number(merged.rawConfidence.toFixed(4)),
      partial,
    };
  }

  async recognize(image: Buffer): Promise<EngineResult> {
    await this.load();
    if (this.active >= this.maxConcurrency) throw new EngineUnavailableError('node engine busy');
    this.active += 1;
    try {
      const t0 = performance.now();
      const img = await decodeToRgb(image, this.maxSide);
      const t1 = performance.now();
      let dets: Detection[];
      try {
        dets = await this.detect(img, this.detector as InferenceSession, this.detectorSize, 'yolo');
      } catch (error) {
        // Some exports pin the input to 640x640 without exposing it in metadata.
        if (this.detectorSize === 640) throw error;
        this.detectorSize = 640;
        dets = await this.detect(img, this.detector as InferenceSession, this.detectorSize, 'yolo');
      }
      if (!dets.length && this.detectorFallback) {
        dets = await this.detect(img, this.detectorFallback, fixedSquare(this.detectorFallback) ?? 640, 'yolo-fallback');
      }
      if (!dets.length) dets = guidedBoxes(img.width, img.height);
      const t2 = performance.now();
      const candidates: EngineCandidate[] = [];
      for (const det of dets.slice(0, 3)) {
        const cand = await this.readDetection(img, det);
        candidates.push(cand);
        if (cand.valid && cand.confidence >= EARLY_EXIT_PROBABILITY) break;
      }
      const t3 = performance.now();
      candidates.sort((a, b) => Number(b.valid) - Number(a.valid)
        || b.confidence * (0.5 + 0.5 * Math.min(1, b.detConf * 2)) - a.confidence * (0.5 + 0.5 * Math.min(1, a.detConf * 2)));
      return {
        ok: true,
        engine: 'node',
        modelVersion: 'node-local',
        image: { w: img.width, h: img.height },
        candidates,
        timings: {
          decodeMs: round(t1 - t0),
          detectMs: round(t2 - t1),
          ocrMs: round(t3 - t2),
          totalMs: round(t3 - t0),
        },
      };
    } finally {
      this.active -= 1;
    }
  }
}

function fixedSquare(session: InferenceSession): number | null {
  const meta = (session as unknown as { inputMetadata?: Array<{ shape?: Array<number | string> }> }).inputMetadata?.[0];
  const shape = meta?.shape;
  if (shape && typeof shape[2] === 'number' && shape[2] === shape[3]) return shape[2];
  return null;
}

const round = (ms: number) => Math.round(ms * 100) / 100;
