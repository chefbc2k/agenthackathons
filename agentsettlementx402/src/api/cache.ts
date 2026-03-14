import { Redis } from "@upstash/redis";

export interface ListCache {
  get<TValue>(key: string): Promise<TValue | null>;
  set<TValue>(key: string, value: TValue, ttlSeconds: number): Promise<void>;
}

export interface UpstashRedisCacheConfig {
  readonly restToken: string;
  readonly restUrl: string;
}

export class NoopListCache implements ListCache {
  public get<TValue>(_key: string): Promise<TValue | null> {
    return Promise.resolve(null);
  }

  public set<TValue>(
    _key: string,
    _value: TValue,
    _ttlSeconds: number,
  ): Promise<void> {
    return Promise.resolve();
  }
}

export class UpstashListCache implements ListCache {
  public constructor(private readonly redis: Redis) {}

  public async get<TValue>(key: string): Promise<TValue | null> {
    const value = await this.redis.get<TValue>(key);
    return value ?? null;
  }

  public async set<TValue>(
    key: string,
    value: TValue,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(key, value, {
      ex: ttlSeconds,
    });
  }
}

export const createUpstashListCache = (
  config: UpstashRedisCacheConfig,
): ListCache => {
  return new UpstashListCache(
    new Redis({
      token: config.restToken,
      url: config.restUrl,
    }),
  );
};

export const createListCacheKey = (
  resource: "agents" | "services",
  page: number,
  pageSize: number,
): string => {
  return `api:${resource}:page=${page}:pageSize=${pageSize}`;
};
