import { describe, expect, it, vi } from "vitest";

import {
  createCliApiApp,
  createCacheFromEnvironment,
  createLoggerFromEnvironment,
  readEnvironment,
  readDebugMode,
  readPort,
  runApiServerFromEnvironment,
} from "../../src/api/cli.js";
import { NoopListCache, UpstashListCache } from "../../src/api/cache.js";

describe("api cli helpers", () => {
  it("defaults to a no-op cache when Upstash credentials are absent", () => {
    const cache = createCacheFromEnvironment({});

    expect(cache).toBeInstanceOf(NoopListCache);
  });

  it("creates an Upstash cache when credentials are present", () => {
    const cache = createCacheFromEnvironment({
      UPSTASH_REDIS_REST_TOKEN: "token",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    });

    expect(cache).toBeInstanceOf(UpstashListCache);
  });

  it("reads an empty environment when process is unavailable", () => {
    vi.stubGlobal("process", undefined);

    expect(readEnvironment()).toEqual({});

    vi.unstubAllGlobals();
  });

  it("parses valid ports and falls back for invalid values", () => {
    expect(readPort({ PORT: "9090" })).toBe(9090);
    expect(readPort({ PORT: "0" })).toBe(8080);
    expect(readPort({ PORT: "-1" })).toBe(8080);
    expect(readPort({ PORT: "not-a-number" })).toBe(8080);
    expect(readPort({})).toBe(8080);
  });

  it("reads debug mode from the environment", () => {
    expect(readDebugMode({ DEBUG_MODE: "true" })).toBe(true);
    expect(readDebugMode({ DEBUG_MODE: "false" })).toBe(false);
    expect(readDebugMode({})).toBe(false);
  });

  it("creates a structured logger with environment-controlled debug behavior", () => {
    const lines: string[] = [];
    const originalConsoleLog = console.log;
    console.log = (line?: unknown) => {
      lines.push(String(line));
    };

    try {
      const logger = createLoggerFromEnvironment({
        DEBUG_MODE: "true",
      });

      logger.debug("debug_enabled", { payer: "0xpayer123456" });
    } finally {
      console.log = originalConsoleLog;
    }

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("debug_enabled");
    expect(lines[0]).not.toContain("0xpayer123456");
  });

  it("creates a runnable CLI app with deterministic health behavior", async () => {
    const app = createCliApiApp({});

    await expect(app.handle({ method: "GET", url: "/health" })).resolves.toEqual({
      body: { status: "ok" },
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      status: 200,
    });
  });

  it("starts the server from runtime environment using the injected port", async () => {
    const listen = vi.fn((_port: number, _hostname: string, callback?: () => void) => {
      callback?.();
    });
    const close = vi.fn((callback?: () => void) => {
      callback?.();
    });
    const createServer = vi.fn(
      () =>
        ({
          close,
          listen,
        }) as const,
    );

    vi.stubGlobal("process", {
      env: {
        PORT: "9191",
      },
    });

    const module = await import("../../src/api/app.js");
    const startSpy = vi
      .spyOn(module, "startApiServer")
      .mockImplementation(({ port }) => {
        const server = createServer();
        server.listen(port ?? 8080, "127.0.0.1", () => undefined);

        return Promise.resolve({
          close: () => {
            server.close(() => undefined);

            return Promise.resolve();
          },
          port: port ?? 8080,
        });
      });

    const started = await runApiServerFromEnvironment();

    expect(startSpy).toHaveBeenCalledOnce();
    expect(createServer).toHaveBeenCalledOnce();
    expect(listen).toHaveBeenCalledWith(9191, "127.0.0.1", expect.any(Function));
    expect(started.port).toBe(9191);
    await started.close();
    expect(close).toHaveBeenCalledOnce();

    startSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
