import type { EngineName, EngineResult, RecognizeMode } from './anpr.types';

interface Bucket {
  requests: number;
  totalMs: number;
  maxMs: number;
  withDetections: number;
  withPlate: number;
}

const emptyBucket = (): Bucket => ({ requests: 0, totalMs: 0, maxMs: 0, withDetections: 0, withPlate: 0 });

/** Rolling counters for the periodic ANPR summary log; `drain()` returns the window and resets it. */
export class AnprStats {
  private buckets = new Map<string, Bucket>();
  private failures = new Map<string, number>();
  private failovers = 0;

  record(engine: EngineName, mode: RecognizeMode, ms: number, result: EngineResult): void {
    const key = `${engine}/${mode}`;
    const bucket = this.buckets.get(key) ?? emptyBucket();
    bucket.requests += 1;
    bucket.totalMs += ms;
    bucket.maxMs = Math.max(bucket.maxMs, ms);
    if ((result.detections ?? result.candidates.length) > 0) bucket.withDetections += 1;
    if (result.candidates.some((c) => c.valid)) bucket.withPlate += 1;
    this.buckets.set(key, bucket);
  }

  fail(engine: EngineName, mode: RecognizeMode, reason: string): void {
    const key = `${engine}/${mode}:${reason}`;
    this.failures.set(key, (this.failures.get(key) ?? 0) + 1);
  }

  failover(): void {
    this.failovers += 1;
  }

  /** One log line for the window, or null when nothing happened. */
  drain(): string | null {
    if (!this.buckets.size && !this.failures.size && !this.failovers) return null;
    const parts = [...this.buckets.entries()].map(([key, b]) =>
      `${key} n=${b.requests} avg=${Math.round(b.totalMs / b.requests)}ms max=${Math.round(b.maxMs)}ms`
      + ` detected=${b.withDetections} plate=${b.withPlate}`);
    if (this.failures.size) {
      parts.push(`failures ${[...this.failures.entries()].map(([k, n]) => `${k}=${n}`).join(' ')}`);
    }
    parts.push(`failovers=${this.failovers}`);
    this.buckets = new Map();
    this.failures = new Map();
    this.failovers = 0;
    return parts.join(' | ');
  }
}

export function failureReason(error: unknown): string {
  if (error && typeof error === 'object' && 'kind' in error && typeof error.kind === 'string') return error.kind;
  if (error instanceof Error) return error.name;
  return 'error';
}
