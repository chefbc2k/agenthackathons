import { Redis } from "@upstash/redis";

import type { WorkerRunResult } from "./orchestrator.js";

export interface WorkerJobState {
  readonly result: WorkerRunResult | null;
  readonly status: "completed" | "in_progress";
}

export interface WorkerIdempotencyStore {
  claim(key: string, ttlSeconds: number): Promise<boolean>;
  complete(key: string, result: WorkerRunResult, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<WorkerJobState | null>;
}

export interface WorkerIdempotencyRedisClient {
  get<TValue>(key: string): Promise<TValue | null>;
  set<TValue>(
    key: string,
    value: TValue,
    options: { ex: number; nx?: boolean },
  ): Promise<unknown>;
}

export class InMemoryWorkerIdempotencyStore implements WorkerIdempotencyStore {
  private readonly states = new Map<string, WorkerJobState>();

  public claim(key: string, _ttlSeconds: number): Promise<boolean> {
    if (this.states.has(key)) {
      return Promise.resolve(false);
    }

    this.states.set(key, {
      result: null,
      status: "in_progress",
    });
    return Promise.resolve(true);
  }

  public complete(
    key: string,
    result: WorkerRunResult,
    _ttlSeconds: number,
  ): Promise<void> {
    this.states.set(key, {
      result,
      status: "completed",
    });
    return Promise.resolve();
  }

  public get(key: string): Promise<WorkerJobState | null> {
    return Promise.resolve(this.states.get(key) ?? null);
  }
}

export class UpstashWorkerIdempotencyStore implements WorkerIdempotencyStore {
  public constructor(private readonly redis: WorkerIdempotencyRedisClient) {}

  public async claim(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set<WorkerJobState>(
      key,
      {
        result: null,
        status: "in_progress",
      },
      {
        ex: ttlSeconds,
        nx: true,
      },
    );

    return result === "OK";
  }

  public complete(
    key: string,
    result: WorkerRunResult,
    ttlSeconds: number,
  ): Promise<void> {
    return this.redis
      .set<WorkerJobState>(
        key,
        {
          result,
          status: "completed",
        },
        {
          ex: ttlSeconds,
        },
      )
      .then(() => undefined);
  }

  public async get(key: string): Promise<WorkerJobState | null> {
    return (await this.redis.get<WorkerJobState>(key)) ?? null;
  }
}

export const createUpstashWorkerIdempotencyStore = (
  restUrl: string,
  restToken: string,
): WorkerIdempotencyStore => {
  return new UpstashWorkerIdempotencyStore(
    new Redis({
      token: restToken,
      url: restUrl,
    }) as unknown as WorkerIdempotencyRedisClient,
  );
};
