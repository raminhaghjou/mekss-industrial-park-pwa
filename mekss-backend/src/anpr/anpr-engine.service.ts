import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnprStats, failureReason } from './anpr-stats';
import { EngineName, EngineResult, EngineUnavailableError, InvalidImageError, RecognizeMode } from './anpr.types';
import { CircuitBreaker } from './circuit-breaker';
import { NodeAnprEngine } from './engines/node-anpr.engine';
import { PythonAnprEngine } from './engines/python-anpr.engine';

const SUMMARY_INTERVAL_MS = 60_000;

export interface EngineStatus {
  primary: 'python';
  /** True when at least one engine can recognise plates right now. */
  available: boolean;
  breaker: string;
  pythonConfigured: boolean;
  pythonAvailable: boolean;
  nodeAvailable: boolean;
  nodeState: 'ready' | 'loading' | 'failed' | 'idle';
  nodeError: string | null;
}

/**
 * Routes frames to engine A (Python) and fails over to engine B (in-process Node) when the
 * Python service errors, times out or its circuit is open. A frame that fails on Python is
 * retried on Node immediately so the guard never loses a read.
 */
@Injectable()
export class AnprEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnprEngineService.name);
  private readonly breaker: CircuitBreaker;
  readonly stats = new AnprStats();
  private summaryTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly python: PythonAnprEngine,
    private readonly node: NodeAnprEngine,
    config: ConfigService,
  ) {
    this.breaker = new CircuitBreaker(
      Number(config.get<string>('ANPR_BREAKER_FAILURES', '3')) || 3,
      Number(config.get<string>('ANPR_BREAKER_COOLDOWN_MS', '30000')) || 30_000,
    );
  }

  onModuleInit(): void {
    this.summaryTimer = setInterval(() => this.logSummary(), SUMMARY_INTERVAL_MS);
    this.summaryTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.summaryTimer) clearInterval(this.summaryTimer);
    this.summaryTimer = null;
  }

  get breakerState() {
    return this.breaker.state;
  }

  logSummary(): void {
    const line = this.stats.drain();
    if (line) this.logger.log(`anpr last ${SUMMARY_INTERVAL_MS / 1000}s: ${line} breaker=${this.breaker.state}`);
  }

  async recognize(image: Buffer, mode: RecognizeMode = 'live'): Promise<EngineResult> {
    if (this.breaker.allowRequest()) {
      const started = performance.now();
      try {
        const result = await this.python.recognize(image, { mode });
        this.breaker.recordSuccess();
        return this.done('python', mode, started, result);
      } catch (error) {
        this.stats.fail('python', mode, failureReason(error));
        if (error instanceof InvalidImageError) {
          this.breaker.recordSuccess();
          throw error;
        }
        // A slow multi-scale photo or a momentarily saturated service says nothing about whether
        // engine A is down, so it must not open the breaker for every live frame that follows.
        const neutral = error instanceof EngineUnavailableError
          && (error.kind === 'busy' || (mode === 'photo' && error.kind === 'timeout'));
        if (neutral) this.breaker.release();
        else this.breaker.recordFailure();
        this.logger.warn(`python engine failed (${(error as Error).message}); mode=${mode} breaker=${this.breaker.state}`);
      }
      this.stats.failover();
    }
    const started = performance.now();
    try {
      return this.done('node', mode, started, await this.node.recognize(image, { mode }));
    } catch (error) {
      this.stats.fail('node', mode, failureReason(error));
      throw error;
    }
  }

  private done(engine: EngineName, mode: RecognizeMode, started: number, result: EngineResult): EngineResult {
    const ms = performance.now() - started;
    this.stats.record(engine, mode, ms, result);
    const best = result.candidates[0];
    this.logger.debug(
      `anpr engine=${engine} mode=${mode} ms=${Math.round(ms)} detections=${result.detections ?? result.candidates.length}`
      + ` candidates=${result.candidates.length} valid=${result.candidates.some((c) => c.valid)}`
      + (best ? ` conf=${best.confidence.toFixed(2)}` : ''),
    );
    return result;
  }

  /** Cheap: never loads models on the request path (engine B warms up at startup). */
  async status(): Promise<EngineStatus> {
    const pythonAvailable = await this.python.isAvailable();
    const node = this.node.state();
    const nodeAvailable = node.state === 'ready';
    return {
      primary: 'python',
      available: pythonAvailable || nodeAvailable || node.state === 'loading',
      breaker: this.breaker.state,
      pythonConfigured: this.python.configured,
      pythonAvailable,
      nodeAvailable,
      nodeState: node.state,
      nodeError: node.error,
    };
  }
}
