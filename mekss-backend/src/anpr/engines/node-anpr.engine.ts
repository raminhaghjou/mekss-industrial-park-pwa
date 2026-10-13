import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import type { InferenceSession, Tensor } from 'onnxruntime-node';
import sharp = require('sharp');
import { AnprEngine, EngineCandidate, EngineResult, EngineUnavailableError, RecognizeMode, RecognizeOptions } from '../anpr.types';
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
const PHOTO_DET_CONF = 0.15;
const MODEL_FILES = ['plate_yolo.onnx', 'ocr_crnn.onnx', 'ocr_crnn.labels.json'] as const;
/** How long a request may wait for a free inference slot before it is shed. */
const QUEUE_WAIT_MS: Record<RecognizeMode, number> = { live: 3000, photo: 15000 };

/** Global NMS over detections gathered from several scales / tiles. */
export function mergeDetections(dets: Detection[], iouThreshold: number): Detection[] {
  const sorted = [...dets].sort((a, b) => b.conf - a.conf);
  const kept: Detection[] = [];
  for (const d of sorted) {
    const overlaps = kept.some((k) => {
      const iw = Math.max(0, Math.min(k.x + k.w, d.x + d.w) - Math.max(k.x, d.x));
      const ih = Math.max(0, Math.min(k.y + k.h, d.y + d.h) - Math.max(k.y, d.y));
      const inter = iw * ih;
      return inter / (k.w * k.h + d.w * d.h - inter + 1e-9) > iouThreshold;
    });
    if (!overlaps) kept.push(d);
  }
  return kept;
}

/** 2x2 overlapping windows covering the image, so a small plate in a full-scene photo becomes large. */
export function tileWindows(width: number, height: number, fraction = 0.62): Box[] {
  const tw = Math.max(1, Math.floor(width * fraction));
  const th = Math.max(1, Math.floor(height * fraction));
  const xs = [...new Set([0, width - tw])];
  const ys = [...new Set([0, height - th])];
  return ys.flatMap((y) => xs.map((x) => ({ x, y, w: tw, h: th })));
}

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

/**
 * Candidate model locations, first match per file wins: the configured dir (Docker volume), then the
 * repo copies so a bare `npm run start` next to `mekss-anpr` works without any download.
 */
export function modelSearchDirs(configured: string | undefined, cwd = process.cwd()): string[] {
  return [...new Set([
    ...(configured ? [resolve(cwd, configured)] : []),
    join(cwd, 'models', 'iran-plate'),
    join(cwd, '..', 'mekss-anpr', 'models'),
    join(cwd, '..', 'mekss-anpr', 'models', 'bundled'),
    join(cwd, '..', 'mekss-industrial-park', 'public', 'models', 'iran-plate'),
  ])];
}

/** Engine B: in-process fail-over engine (onnxruntime-node + sharp). */
@Injectable()
export class NodeAnprEngine implements AnprEngine, OnModuleInit {
  readonly name = 'node' as const;
  private readonly logger = new Logger(NodeAnprEngine.name);
  private readonly searchDirs: string[];
  private readonly detConf: number;
  private readonly maxSide: number;
  private readonly maxConcurrency: number;
  private readonly maxQueue: number;
  private readonly tta: boolean;
  private readonly warmOnStart: boolean;
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  private loading: Promise<void> | null = null;
  private loadError: Error | null = null;
  private loadErrorAt = 0;
  private ort: OrtModule | null = null;
  private detector: InferenceSession | null = null;
  private detectorFallback: InferenceSession | null = null;
  private recognizer: InferenceSession | null = null;
  private labels: string[] = [];
  private detectorSize = 416;
  /** Null while the detector accepts any square input size (the bundled export does). */
  private detectorFixed: number | null = null;
  private recognizerBatchable = false;

  constructor(config: ConfigService) {
    this.searchDirs = modelSearchDirs(config.get<string>('ANPR_MODEL_DIR'));
    this.detConf = Number(config.get<string>('ANPR_DET_CONF', '0.25')) || 0.25;
    this.maxSide = Number(config.get<string>('ANPR_MAX_SIDE', '1600')) || 1600;
    this.maxConcurrency = Number(config.get<string>('ANPR_NODE_CONCURRENCY', '2')) || 2;
    this.maxQueue = Number(config.get<string>('ANPR_NODE_QUEUE', '6')) || 6;
    this.tta = config.get<string>('ANPR_TTA', 'true') !== 'false';
    this.warmOnStart = config.get<string>('ANPR_NODE_WARMUP', process.env.NODE_ENV === 'test' ? 'false' : 'true') !== 'false';
  }

  onModuleInit(): void {
    if (!this.warmOnStart) return;
    void this.load()
      .then(() => this.warmup())
      .catch(() => undefined);
  }

  /** Non-blocking health snapshot for `/anpr/status`; kicks off a (re)load in the background. */
  state(): { state: 'ready' | 'loading' | 'failed' | 'idle'; error: string | null } {
    if (this.recognizer) return { state: 'ready', error: null };
    if (this.loadError && Date.now() - this.loadErrorAt < LOAD_RETRY_MS) return { state: 'failed', error: this.loadError.message };
    if (!this.loading || this.loadError) void this.load().catch(() => undefined);
    return { state: 'loading', error: null };
  }

  private file(name: string): string | null {
    for (const dir of this.searchDirs) {
      const path = join(dir, name);
      if (existsSync(path)) return path;
    }
    return null;
  }

  private async warmup(): Promise<void> {
    try {
      const jpeg = await sharp({ create: { width: 640, height: 220, channels: 3, background: { r: 200, g: 200, b: 200 } } }).jpeg().toBuffer();
      const started = Date.now();
      await this.recognize(jpeg, { mode: 'live' });
      this.logger.log(`Node ANPR engine warmed up in ${Date.now() - started}ms`);
    } catch (error) {
      this.logger.warn(`Node ANPR warm-up failed: ${(error as Error).message}`);
    }
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
        const missing = MODEL_FILES.filter((f) => !this.file(f));
        if (missing.length) {
          throw new EngineUnavailableError(`node engine models missing (${missing.join(', ')}); searched ${this.searchDirs.join(', ')}`, false);
        }
        this.ort = await import('onnxruntime-node');
        const options: InferenceSession.SessionOptions = {
          graphOptimizationLevel: 'all',
          intraOpNumThreads: Number(process.env.ANPR_NODE_THREADS || 2),
          interOpNumThreads: 1,
          executionMode: 'sequential',
        };
        const detectorPath = this.file('plate_yolo.onnx') as string;
        this.detector = await this.ort.InferenceSession.create(detectorPath, options);
        const fallbackPath = this.file('plate_yolo_fallback.onnx');
        if (fallbackPath) this.detectorFallback = await this.ort.InferenceSession.create(fallbackPath, options);
        const labels = JSON.parse(readFileSync(this.file('ocr_crnn.labels.json') as string, 'utf8'));
        const recognizer = await this.ort.InferenceSession.create(this.file('ocr_crnn.onnx') as string, options);
        this.labels = labels;
        this.detectorFixed = fixedSquare(this.detector);
        this.detectorSize = this.detectorFixed ?? 416;
        this.recognizerBatchable = true;
        this.recognizer = recognizer;
        this.logger.log(`Node ANPR engine loaded (${detectorPath}${this.detectorFixed ? `, fixed ${this.detectorFixed}px` : ', multi-scale'})`);
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

  /** Bounded wait for a free inference slot instead of failing instantly with "busy". */
  private async acquire(mode: RecognizeMode): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active += 1;
      return;
    }
    if (this.waiters.length >= this.maxQueue) throw new EngineUnavailableError('node engine busy', true, 'busy');
    await new Promise<void>((resolveSlot, reject) => {
      const grant = () => {
        clearTimeout(timer);
        resolveSlot();
      };
      const timer = setTimeout(() => {
        const index = this.waiters.indexOf(grant);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new EngineUnavailableError('node engine busy', true, 'busy'));
      }, QUEUE_WAIT_MS[mode]);
      this.waiters.push(grant);
    });
  }

  /** Hands the slot straight to the next waiter (so `active` is unchanged) or frees it. */
  private release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.active -= 1;
  }

  private async detect(img: RgbImage, session: InferenceSession, size: number, source: string, conf = this.detConf): Promise<Detection[]> {
    const ort = this.ort as OrtModule;
    const lb = await letterboxTensor(img, size);
    const input = new ort.Tensor('float32', lb.tensor, [1, 3, size, size]);
    const out = await session.run({ [session.inputNames[0]]: input });
    const tensor = out[session.outputNames[0]] as Tensor;
    return decodeYolo(tensor.data as Float32Array, tensor.dims, { ...lb, width: img.width, height: img.height }, conf, 0.45)
      .map((d) => ({ ...d, source }));
  }

  private async detectAt(img: RgbImage, size: number, source: string, conf: number): Promise<Detection[]> {
    try {
      return await this.detect(img, this.detector as InferenceSession, size, source, conf);
    } catch (error) {
      // Some exports pin the input to 640x640 without exposing it in metadata.
      if (this.detectorFixed === 640) throw error;
      this.detectorFixed = 640;
      this.detectorSize = 640;
      return this.detect(img, this.detector as InferenceSession, 640, source, conf);
    }
  }

  private scales(preferred: number[]): number[] {
    return this.detectorFixed ? [this.detectorFixed] : [...new Set(preferred)];
  }

  /**
   * Live: 416 then 640. Photo: 640, 960, then 2x2 overlapping tiles: a plate covering a few percent of
   * a full-scene phone photo is invisible at 416 but large inside a tile.
   */
  private async detectMultiScale(img: RgbImage, mode: RecognizeMode): Promise<Detection[]> {
    const conf = mode === 'photo' ? Math.min(this.detConf, PHOTO_DET_CONF) : this.detConf;
    let dets: Detection[] = [];
    for (const size of this.scales(mode === 'photo' ? [640, 960] : [this.detectorSize, 640])) {
      dets = await this.detectAt(img, size, mode === 'photo' ? `yolo-${size}` : 'yolo', conf);
      if (dets.length) return dets;
    }
    if (mode === 'photo' && Math.max(img.width, img.height) >= 800) {
      const found: Detection[] = [];
      for (const win of tileWindows(img.width, img.height)) {
        const tile = cropRgb(img, win);
        for (const d of await this.detectAt(tile, this.detectorFixed ?? 640, 'yolo-tile', conf)) {
          found.push({ ...d, x: d.x + win.x, y: d.y + win.y, source: 'yolo-tile' });
        }
      }
      dets = mergeDetections(found, 0.45);
      if (dets.length) return dets;
    }
    // Still photos only: most live frames legitimately contain no plate, and a third model per empty
    // frame would triple its cost.
    if (mode === 'photo' && this.detectorFallback) {
      dets = await this.detect(img, this.detectorFallback, fixedSquare(this.detectorFallback) ?? 640, 'yolo-fallback', conf);
    }
    return dets;
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

  private async readDetection(img: RgbImage, det: Detection, tta: boolean): Promise<EngineCandidate> {
    const tight = cropRgb(img, det);
    const padded = cropRgb(img, padBox(det, img.width, img.height, 0.12));
    const rotated = await deskew(padded);
    const crops = [tight, ...(rotated ? [rotated] : []), ...(tta ? shiftVariants(tight) : [])];
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

  async recognize(image: Buffer, options: RecognizeOptions = {}): Promise<EngineResult> {
    const mode = options.mode ?? 'live';
    await this.load();
    await this.acquire(mode);
    try {
      const t0 = performance.now();
      const img = await decodeToRgb(image, this.maxSide);
      const t1 = performance.now();
      let dets = await this.detectMultiScale(img, mode);
      const detections = dets.length;
      if (!dets.length) dets = guidedBoxes(img.width, img.height);
      const t2 = performance.now();
      const candidates: EngineCandidate[] = [];
      for (const det of dets.slice(0, mode === 'photo' ? 5 : 2)) {
        const cand = await this.readDetection(img, det, this.tta && mode === 'photo');
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
        mode,
        detections,
        timings: {
          decodeMs: round(t1 - t0),
          detectMs: round(t2 - t1),
          ocrMs: round(t3 - t2),
          totalMs: round(t3 - t0),
        },
      };
    } finally {
      this.release();
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
