import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'undici';
import { AnprEngine, EngineResult, EngineUnavailableError, InvalidImageError, RecognizeOptions } from '../anpr.types';

/** A live frame needs detect + OCR (~0.3-0.8 s on a small VPS); anything lower times out every frame. */
const MIN_LIVE_TIMEOUT_MS = 1000;
const STATUS_CACHE_MS = 5000;

const isTimeout = (error: unknown) => {
  const name = (error as { name?: string; code?: string })?.name ?? '';
  const code = (error as { code?: string })?.code ?? '';
  return name === 'TimeoutError' || name === 'AbortError' || code === 'UND_ERR_HEADERS_TIMEOUT' || code === 'UND_ERR_BODY_TIMEOUT';
};

/** Engine A: the mekss-anpr Python service (OpenCV + ONNX Runtime) over a keep-alive pool. */
@Injectable()
export class PythonAnprEngine implements AnprEngine, OnModuleDestroy {
  readonly name = 'python' as const;
  private readonly logger = new Logger(PythonAnprEngine.name);
  private readonly pool: Pool | null;
  readonly liveTimeoutMs: number;
  readonly photoTimeoutMs: number;
  private readyCache: { value: boolean; at: number; pending: Promise<boolean> | null } = { value: false, at: 0, pending: null };

  constructor(config: ConfigService) {
    const url = config.get<string>('ANPR_SERVICE_URL');
    const configuredLive = Number(config.get<string>('ANPR_LIVE_TIMEOUT_MS') ?? config.get<string>('ANPR_TIMEOUT_MS', '1500')) || 1500;
    this.liveTimeoutMs = Math.max(MIN_LIVE_TIMEOUT_MS, configuredLive);
    if (configuredLive < MIN_LIVE_TIMEOUT_MS) {
      this.logger.warn(`ANPR live timeout ${configuredLive}ms is below one inference; using ${this.liveTimeoutMs}ms`);
    }
    this.photoTimeoutMs = Math.max(this.liveTimeoutMs, Number(config.get<string>('ANPR_PHOTO_TIMEOUT_MS', '8000')) || 8000);
    this.pool = url
      ? new Pool(url, { connections: Number(config.get<string>('ANPR_POOL_CONNECTIONS', '8')) || 8, pipelining: 1, keepAliveTimeout: 30_000 })
      : null;
    if (!url) this.logger.warn('ANPR_SERVICE_URL is not set; Python ANPR engine disabled');
  }

  get configured(): boolean {
    return this.pool !== null;
  }

  async recognize(image: Buffer, options: RecognizeOptions = {}): Promise<EngineResult> {
    if (!this.pool) throw new EngineUnavailableError('python engine not configured', false);
    const mode = options.mode ?? 'live';
    const timeoutMs = mode === 'photo' ? this.photoTimeoutMs : this.liveTimeoutMs;
    const timeout = AbortSignal.timeout(timeoutMs);
    const combined = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    let res;
    try {
      res = await this.pool.request({
        path: mode === 'photo' ? '/v1/recognize?mode=photo' : '/v1/recognize?mode=live',
        method: 'POST',
        headers: { 'content-type': 'image/jpeg' },
        body: image,
        signal: combined,
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
      });
    } catch (error) {
      const timedOut = isTimeout(error);
      throw new EngineUnavailableError(
        timedOut ? `python engine timed out after ${timeoutMs}ms (${mode})` : `python engine request failed: ${(error as Error).message}`,
        true,
        timedOut ? 'timeout' : 'unavailable',
      );
    }
    const text = await res.body.text();
    if (res.statusCode === 400) throw new InvalidImageError();
    if (res.statusCode === 503) throw new EngineUnavailableError(`python engine busy or not ready (${text.slice(0, 80)})`, true, 'busy');
    if (res.statusCode !== 200) throw new EngineUnavailableError(`python engine HTTP ${res.statusCode}`);
    const result = JSON.parse(text) as EngineResult;
    return { ...result, engine: 'python' };
  }

  /** Cached readiness probe so `/anpr/status` stays cheap under polling. */
  async isAvailable(): Promise<boolean> {
    if (!this.pool) return false;
    if (Date.now() - this.readyCache.at < STATUS_CACHE_MS) return this.readyCache.value;
    this.readyCache.pending ??= this.probe().then((value) => {
      this.readyCache = { value, at: Date.now(), pending: null };
      return value;
    });
    return this.readyCache.pending;
  }

  private async probe(): Promise<boolean> {
    try {
      const res = await (this.pool as Pool).request({ path: '/ready', method: 'GET', signal: AbortSignal.timeout(1000) });
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
