import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'undici';
import { AnprEngine, EngineResult, EngineUnavailableError, InvalidImageError } from '../anpr.types';

/** Engine A: the mekss-anpr Python service (OpenCV + ONNX Runtime) over a keep-alive pool. */
@Injectable()
export class PythonAnprEngine implements AnprEngine, OnModuleDestroy {
  readonly name = 'python' as const;
  private readonly logger = new Logger(PythonAnprEngine.name);
  private readonly pool: Pool | null;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    const url = config.get<string>('ANPR_SERVICE_URL');
    this.timeoutMs = Number(config.get<string>('ANPR_TIMEOUT_MS', '400')) || 400;
    this.pool = url
      ? new Pool(url, { connections: Number(config.get<string>('ANPR_POOL_CONNECTIONS', '8')) || 8, pipelining: 1, keepAliveTimeout: 30_000 })
      : null;
    if (!url) this.logger.warn('ANPR_SERVICE_URL is not set; Python ANPR engine disabled');
  }

  async recognize(image: Buffer, signal?: AbortSignal): Promise<EngineResult> {
    if (!this.pool) throw new EngineUnavailableError('python engine not configured', false);
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let res;
    try {
      res = await this.pool.request({
        path: '/v1/recognize',
        method: 'POST',
        headers: { 'content-type': 'image/jpeg' },
        body: image,
        signal: combined,
        headersTimeout: this.timeoutMs,
        bodyTimeout: this.timeoutMs,
      });
    } catch (error) {
      throw new EngineUnavailableError(`python engine request failed: ${(error as Error).message}`);
    }
    const text = await res.body.text();
    if (res.statusCode === 400) throw new InvalidImageError();
    if (res.statusCode !== 200) throw new EngineUnavailableError(`python engine HTTP ${res.statusCode}`);
    const result = JSON.parse(text) as EngineResult;
    return { ...result, engine: 'python' };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      const res = await this.pool.request({ path: '/ready', method: 'GET', signal: AbortSignal.timeout(1000) });
      await res.body.dump();
      return res.statusCode === 200;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.pool?.close();
  }
}
