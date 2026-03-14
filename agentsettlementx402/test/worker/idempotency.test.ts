import { describe, expect, it } from "vitest";

import {
  InMemoryWorkerIdempotencyStore,
  UpstashWorkerIdempotencyStore,
  createUpstashWorkerIdempotencyStore,
} from "../../src/worker/idempotency.js";

const result = {
  completedAt: new Date("2026-03-13T00:00:00.000Z"),
  jobKey: "job-1",
  stages: {
    a2a: { created: 0, noop: 0, processed: 0, skipped: true, updated: 0 },
    bazaar: { created: 0, noop: 0, processed: 0, skipped: true, updated: 0 },
    linking: { created: 0, noop: 0, processed: 0, skipped: true, updated: 0 },
    metrics: {
      created: 0,
      noop: 0,
      processed: 0,
      scores: [],
      skipped: true,
      updated: 0,
    },
  },
} as const;

describe("InMemoryWorkerIdempotencyStore", () => {
  it("claims, completes, and retrieves job states", async () => {
    const store = new InMemoryWorkerIdempotencyStore();

    await expect(store.claim("job-1", 60)).resolves.toBe(true);
    await expect(store.claim("job-1", 60)).resolves.toBe(false);
    await expect(store.get("job-1")).resolves.toEqual({
      result: null,
      status: "in_progress",
    });
    await expect(store.complete("job-1", result, 60)).resolves.toBeUndefined();
    await expect(store.get("job-1")).resolves.toEqual({
      result,
      status: "completed",
    });
  });
});

describe("UpstashWorkerIdempotencyStore", () => {
  it("maps redis behavior into claim/get/complete semantics", async () => {
    const store = new UpstashWorkerIdempotencyStore({
      get: <TValue>() =>
        Promise.resolve({ result, status: "completed" as const } as TValue),
      set: (_key, _value, options) =>
        Promise.resolve(options.nx ? "OK" : "SET"),
    });

    await expect(store.claim("job-1", 60)).resolves.toBe(true);
    await expect(store.complete("job-1", result, 60)).resolves.toBeUndefined();
    await expect(store.get("job-1")).resolves.toEqual({
      result,
      status: "completed",
    });
  });

  it("treats non-OK claim responses as already claimed", async () => {
    const store = new UpstashWorkerIdempotencyStore({
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(null),
    });

    await expect(store.claim("job-1", 60)).resolves.toBe(false);
    await expect(store.get("job-1")).resolves.toBeNull();
  });

  it("creates an Upstash-backed idempotency store", () => {
    expect(
      createUpstashWorkerIdempotencyStore(
        "https://example.upstash.io",
        "token",
      ),
    ).toBeInstanceOf(UpstashWorkerIdempotencyStore);
  });
});
