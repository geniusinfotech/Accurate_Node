/* eslint-disable prettier/prettier */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Redis as RedisClient } from 'ioredis';

/**
 * Thin wrapper around an ioredis client used as a read cache.
 * Reduces database load by serving frequent public reads from Redis.
 */
@Injectable()
export class RedisCacheService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisCacheService.name);
  private client?: RedisClient;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = Boolean(this.config.get<string>('REDIS_HOST'));
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Redis disabled (REDIS_HOST not set). Caching inactive.');
      return;
    }
    const host = this.config.get<string>('REDIS_HOST') || '127.0.0.1';
    const port = parseInt(this.config.get<string>('REDIS_PORT') || '6379', 10);
    const password = this.config.get<string>('REDIS_PASSWORD') || undefined;
    const db = parseInt(this.config.get<string>('REDIS_DB') || '0', 10);

    this.client = new Redis({
      host,
      port,
      password,
      db,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) =>
      this.logger.warn(`Redis error: ${err.message}`),
    );
    this.client
      .connect()
      .catch((err) => this.logger.warn(`Redis connect failed: ${err.message}`));
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.client) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err: any) {
      this.logger.warn(`Cache get error (${key}): ${err?.message || err}`);
      return null;
    }
  }

  async set(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      const ttl =
        ttlSeconds ??
        parseInt(this.config.get<string>('CACHE_TTL') || '300', 10);
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err: any) {
      this.logger.warn(`Cache set error (${key}): ${err?.message || err}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`Cache del error (${key}): ${err?.message || err}`);
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err: any) {
      this.logger.warn(
        `Cache delByPrefix error (${prefix}): ${err?.message || err}`,
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled && Boolean(this.client);
  }

  async onApplicationShutdown() {
    if (this.client && this.client.status === 'ready') {
      await this.client.quit().catch(() => undefined);
    } else if (this.client) {
      this.client.disconnect();
    }
  }
}