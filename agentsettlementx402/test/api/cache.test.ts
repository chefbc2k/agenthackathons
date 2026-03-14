import { describe, expect, it } from "vitest";

import {
  NoopListCache,
  UpstashListCache,
  createListCacheKey,
  createUpstashListCache,
} from "../../src/api/cache.js";

describe("api cache helpers", () => {
  it("creates deterministic cache keys", () => {
    expect(createListCacheKey("agents", 2, 25)).toBe(
      "api:agents:page=2:pageSize=25",
    );
  });

  it("provides a no-op cache implementation", async () => {
    const cache = new NoopListCache();

    await expect(cache.get("missing")).resolves.toBeNull();
    await expect(cache.set("key", { ok: true }, 30)).resolves.toBeUndefined();
  });

  it("delegates cache operations to the wrapped Upstash client", async () => {
    const cache = new UpstashListCache({
      get: () => Promise.resolve({ ok: true }),
      set: () => Promise.resolve("OK"),
    } as {
      get: <TValue>(key: string) => Promise<TValue>;
      set: <TValue>(
        key: string,
        value: TValue,
        options: { ex: number },
      ) => Promise<string>;
    } as never);

    await expect(cache.get("key")).resolves.toEqual({ ok: true });
    await expect(cache.set("key", { ok: true }, 15)).resolves.toBeUndefined();
  });

  it("normalizes nullish Upstash cache misses", async () => {
    const cache = new UpstashListCache({
      get: () => Promise.resolve(null),
      set: () => Promise.resolve("OK"),
    } as {
      get: <TValue>(key: string) => Promise<TValue | null>;
      set: <TValue>(
        key: string,
        value: TValue,
        options: { ex: number },
      ) => Promise<string>;
    } as never);

    await expect(cache.get("missing")).resolves.toBeNull();
  });

  it("constructs an Upstash cache adapter from credentials", () => {
    const cache = createUpstashListCache({
      restToken: "token",
      restUrl: "https://example.upstash.io",
    });

    expect(cache).toBeInstanceOf(UpstashListCache);
  });
});
