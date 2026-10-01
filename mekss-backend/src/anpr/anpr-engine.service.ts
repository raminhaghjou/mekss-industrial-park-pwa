import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EngineResult, InvalidImageError } from './anpr.types';
import { CircuitBreaker } from './circuit-breaker';
import { NodeAnprEngine } from './engines/node-anpr.engine';
import { PythonAnprEngine } from './engines/python-anpr.engine';

export interface EngineStatus {
  primary: 'python';
  breaker: string;
  pythonAvailable: boolean;
  nodeAvailable: boolean;
}

/**
 * Routes frames to engine A (Python) and fails over to engine B (in-process Node) when the
 * Python service errors, times out or its circuit is open. A frame that fails on Python is
 * retried on Node immediately so the guard never loses a read.
 */
@Injectable()
export class AnprEngineService {
  private readonly logger = new Logger(AnprEngineService.name);
  private readonly breaker: CircuitBreaker;

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

  get breakerState() {
    return this.breaker.state;
  }

  async recognize(image: Buffer): Promise<EngineResult> {
    if (this.breaker.allowRequest()) {
      try {
        const result = await this.python.recognize(image);
        this.breaker.recordSuccess();
        return result;
      } catch (error) {
        if (error instanceof InvalidImageError) {
          this.breaker.recordSuccess();
          throw error;
        }
        this.breaker.recordFailure();
        this.logger.warn(`python engine failed (${(error as Error).message}); breaker=${this.breaker.state}`);
      }
    }
    return this.node.recognize(image);
  }

  async status(): Promise<EngineStatus> {
    const [pythonAvailable, nodeAvailable] = await Promise.all([this.python.isAvailable(), this.node.isAvailable()]);
    return { primary: 'python', breaker: this.breaker.state, pythonAvailable, nodeAvailable };
  }
}
