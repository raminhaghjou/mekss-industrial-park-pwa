import type { PlateTypeName } from './plate-grammar';

export type EngineName = 'python' | 'node';

export interface PositionChoice {
  c: string;
  p: number;
}

export interface EngineCandidate {
  bbox: { x: number; y: number; w: number; h: number };
  detConf: number;
  source: string;
  rectification: string;
  variants: number;
  color: string;
  plateType: PlateTypeName | null;
  colorConflict: boolean;
  plate: string;
  valid: boolean;
  confidence: number;
  charConfidences: number[];
  positions: PositionChoice[][];
  alternatives: { plate: string; p: number }[];
  raw: string;
  rawConfidence: number;
  partial: { number: string } | null;
}

export interface EngineResult {
  ok: boolean;
  engine: EngineName;
  modelVersion: string;
  image: { w: number; h: number };
  candidates: EngineCandidate[];
  timings: Record<string, number>;
}

export interface AnprEngine {
  readonly name: EngineName;
  recognize(image: Buffer, signal?: AbortSignal): Promise<EngineResult>;
  isAvailable(): Promise<boolean>;
}

export class EngineUnavailableError extends Error {
  constructor(message: string, readonly retryable = true) {
    super(message);
    this.name = 'EngineUnavailableError';
  }
}

export class InvalidImageError extends Error {
  constructor(message = 'unsupported or corrupt image') {
    super(message);
    this.name = 'InvalidImageError';
  }
}
