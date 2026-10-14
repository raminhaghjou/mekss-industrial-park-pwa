import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

/** Upper bound for the in-memory fallback so a flood of unique keys cannot exhaust the heap. */
const MEMORY_MAX_KEYS = 50_000;

/**
 * Short-lived counters and one-time markers shared by rate limiting and the captcha.
 * Uses Redis when REDIS_HOST is set (shared across backend instances, survives restarts);
 * falls back to process memory when Redis is not configured or unreachable.
 */
@Injectable()
export class EphemeralStore implements OnModuleDestroy {
  private readonly logger = new Logger(EphemeralStore.name);
  private readonly memory = new Map<string, { value: number; expiresAt: number }>();
  private client: RedisClient | null = null;
  private connecting: Promise<RedisClient | null> | null = null;
  private redisDisabledUntil = 0;

  constructor(private readonly config: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (client?.isOpen) await client.quit().catch(() => undefined);
  }

  /** Atomically increments `key` inside a fixed window and returns the new count. */
  async increment(key: string, windowMs: number): Promise<number> {
    const redis = await this.redis();
    if (redis) {
      try {
        const results = await redis.multi().incr(key).pExpire(key, windowMs, 'NX').exec();
        return Number(results?.[0] ?? 1);
      } catch (error) {
        this.redisFailed(error);
      }
    }
    const now = Date.now();
    const entry = this.memoryEntry(key, now);
    if (entry) {
      entry.value += 1;
      return entry.value;
    }
    this.memorySet(key, 1, now + windowMs);
    return 1;
  }

  /** Returns true only for the first caller within `ttlMs` (one-time tokens, replay protection). */
  async claimOnce(key: string, ttlMs: number): Promise<boolean> {
    const redis = await this.redis();
    if (redis) {
      try {
        return (await redis.set(key, '1', { NX: true, PX: ttlMs })) === 'OK';
      } catch (error) {
        this.redisFailed(error);
      }
    }
    const now = Date.now();
    if (this.memoryEntry(key, now)) return false;
    this.memorySet(key, 1, now + ttlMs);
    return true;
  }

  private memoryEntry(key: string, now: number) {
    const entry = this.memory.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.memory.delete(key);
      return undefined;
    }
    return entry;
  }

  private memorySet(key: string, value: number, expiresAt: number) {
    if (this.memory.size >= MEMORY_MAX_KEYS) {
      const now = Date.now();
      for (const [candidate, entry] of this.memory) if (entry.expiresAt <= now) this.memory.delete(candidate);
      // Still full: drop the oldest insertions (Map keeps insertion order).
      for (const candidate of this.memory.keys()) {
        if (this.memory.size < MEMORY_MAX_KEYS) break;
        this.memory.delete(candidate);
      }
    }
    this.memory.set(key, { value, expiresAt });
  }

  private redisFailed(error: unknown) {
    this.logger.warn(`Redis unavailable, using in-memory store: ${error instanceof Error ? error.message : String(error)}`);
    const client = this.client;
    this.client = null;
    this.redisDisabledUntil = Date.now() + 30_000;
    if (client?.isOpen) client.disconnect().catch(() => undefined);
  }

  private async redis(): Promise<RedisClient | null> {
    const host = this.config.get<string>('REDIS_HOST');
    if (!host || Date.now() < this.redisDisabledUntil) return null;
    if (this.client?.isReady) return this.client;
    if (!this.connecting) {
      this.connecting = this.connect(host).finally(() => { this.connecting = null; });
    }
    return this.connecting;
  }

  private async connect(host: string): Promise<RedisClient | null> {
    const client = createClient({
      socket: {
        host,
        port: Number(this.config.get<string>('REDIS_PORT') || 6379),
        connectTimeout: 2_000,
        reconnectStrategy: false,
      },
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
    });
    client.on('error', () => undefined);
    try {
      await client.connect();
      this.client = client;
      return client;
    } catch (error) {
      this.client = client;
      this.redisFailed(error);
      return null;
    }
  }
}
