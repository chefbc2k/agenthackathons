import { describe, expect, it, vi } from "vitest";

import { InMemoryWorkerIdempotencyStore } from "../../src/worker/idempotency.js";
import {
  createDefaultWorkerReceiverServer,
  createQstashRequestVerifier,
  createWorkerReceiverListener,
  handleWorkerReceiverRequest,
  resolveWorkerReceiverServerFactory,
  resolveWorkerIdempotencyKey,
  startWorkerReceiverServer,
} from "../../src/worker/receiver.js";

const successfulResult = {
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

describe("resolveWorkerIdempotencyKey", () => {
  it("prefers QStash message ids, then job keys, then a deterministic hash", () => {
    expect(
      resolveWorkerIdempotencyKey(
        {
          body: "{}",
          headers: {
            "upstash-message-id": "message-1",
          },
          method: "POST",
          url: "/worker",
        },
        {
          kind: "sync_all",
        },
      ),
    ).toBe("message-1");
    expect(
      resolveWorkerIdempotencyKey(
        {
          body: "{}",
          headers: {},
          method: "POST",
          url: "/worker",
        },
        {
          jobKey: "job-1",
          kind: "sync_all",
        },
      ),
    ).toBe("job-1");
  });
});

describe("handleWorkerReceiverRequest", () => {
  it("runs a new job and replays completed results idempotently", async () => {
    const store = new InMemoryWorkerIdempotencyStore();
    const dependencies = {
      idempotencyStore: store,
      runJob: vi.fn(() => Promise.resolve(successfulResult)),
    };
    const request = {
      body: JSON.stringify({
        jobKey: "job-1",
        kind: "sync_all",
      }),
      headers: {},
      method: "POST",
      url: "/worker",
    } as const;

    await expect(handleWorkerReceiverRequest(request, dependencies)).resolves.toMatchObject({
      status: 200,
      body: {
        replayed: false,
        status: "completed",
      },
    });
    await expect(handleWorkerReceiverRequest(request, dependencies)).resolves.toMatchObject({
      status: 200,
      body: {
        replayed: true,
        status: "completed",
      },
    });
  });

  it("returns in-progress when the idempotency key is already claimed", async () => {
    const store = new InMemoryWorkerIdempotencyStore();
    await store.claim("job-1", 60);

    await expect(
      handleWorkerReceiverRequest(
        {
          body: JSON.stringify({
            jobKey: "job-1",
            kind: "sync_all",
          }),
          headers: {},
          method: "POST",
          url: "/worker",
        },
        {
          idempotencyStore: store,
          runJob: () => Promise.resolve(successfulResult),
        },
      ),
    ).resolves.toMatchObject({
      status: 202,
      body: {
        status: "in_progress",
      },
    });
  });

  it("maps invalid method, json, payload, and signature failures", async () => {
    await expect(
      handleWorkerReceiverRequest(
        {
          body: "{}",
          headers: {},
          method: "GET",
          url: "/worker",
        },
        {
          idempotencyStore: new InMemoryWorkerIdempotencyStore(),
          runJob: () => Promise.resolve(successfulResult),
        },
      ),
    ).resolves.toMatchObject({ status: 405 });
    await expect(
      handleWorkerReceiverRequest(
        {
          body: "{",
          headers: {},
          method: "POST",
          url: "/worker",
        },
        {
          idempotencyStore: new InMemoryWorkerIdempotencyStore(),
          runJob: () => Promise.resolve(successfulResult),
        },
      ),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      handleWorkerReceiverRequest(
        {
          body: JSON.stringify({
            kind: "wrong",
          }),
          headers: {},
          method: "POST",
          url: "/worker",
        },
        {
          idempotencyStore: new InMemoryWorkerIdempotencyStore(),
          runJob: () => Promise.resolve(successfulResult),
        },
      ),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      handleWorkerReceiverRequest(
        {
          body: JSON.stringify({
            kind: "sync_all",
          }),
          headers: {},
          method: "POST",
          url: "/worker",
        },
        {
          idempotencyStore: new InMemoryWorkerIdempotencyStore(),
          runJob: () => Promise.resolve(successfulResult),
          verifier: {
            verify: () => Promise.resolve(true),
          },
        },
      ),
    ).resolves.toMatchObject({ status: 401 });
    await expect(
      handleWorkerReceiverRequest(
        {
          body: JSON.stringify({
            kind: "sync_all",
          }),
          headers: {
            "upstash-signature": "sig",
          },
          method: "POST",
          url: "/worker",
        },
        {
          idempotencyStore: new InMemoryWorkerIdempotencyStore(),
          runJob: () => Promise.resolve(successfulResult),
          verifier: {
            verify: vi.fn(() => {
              throw new Error("bad signature");
            }),
          },
        },
      ),
    ).resolves.toMatchObject({ status: 401 });
  });

  it("maps job execution failures after successful verification", async () => {
    await expect(
      handleWorkerReceiverRequest(
        {
          body: JSON.stringify({
            kind: "sync_all",
          }),
          headers: {
            "upstash-signature": "sig",
          },
          method: "POST",
          url: "/worker",
        },
        {
          idempotencyStore: new InMemoryWorkerIdempotencyStore(),
          runJob: vi.fn(() => {
            throw new Error("boom");
          }),
          verifier: {
            verify: () => Promise.resolve(true),
          },
        },
      ),
    ).resolves.toMatchObject({ status: 500 });
  });

  it("returns in-progress when a claim fails after the initial read", async () => {
    await expect(
      handleWorkerReceiverRequest(
        {
          body: JSON.stringify({
            kind: "sync_all",
          }),
          headers: {},
          method: "POST",
          url: "/worker",
        },
        {
          idempotencyStore: {
            claim: () => Promise.resolve(false),
            complete: () => Promise.resolve(),
            get: () => Promise.resolve(null),
          },
          runJob: () => Promise.resolve(successfulResult),
        },
      ),
    ).resolves.toMatchObject({
      status: 202,
      body: {
        status: "in_progress",
      },
    });
  });

  it("passes optional region headers and omits empty urls during verification", async () => {
    const verify = vi.fn(() => Promise.resolve(true));
    const body = JSON.stringify({
      kind: "sync_all",
    });

    await expect(
      handleWorkerReceiverRequest(
        {
          body,
          headers: {
            "upstash-region": "us1",
            "upstash-signature": "sig",
          },
          method: "POST",
          url: "",
        },
        {
          idempotencyStore: new InMemoryWorkerIdempotencyStore(),
          runJob: () => Promise.resolve(successfulResult),
          verifier: {
            verify,
          },
        },
      ),
    ).resolves.toMatchObject({ status: 200 });
    expect(verify).toHaveBeenCalledWith({
      body,
      signature: "sig",
      upstashRegion: "us1",
    });
  });
});

describe("worker receiver server helpers", () => {
  it("creates a QStash verifier instance", () => {
    expect(
      createQstashRequestVerifier({
        currentSigningKey: "current",
        nextSigningKey: "next",
      }),
    ).toBeDefined();
  });

  it("resolves default and custom receiver server factories", () => {
    const customFactory = vi.fn(() => ({
      close() {},
      listen() {},
    }));

    expect(resolveWorkerReceiverServerFactory()).toBe(createDefaultWorkerReceiverServer);
    expect(resolveWorkerReceiverServerFactory(customFactory)).toBe(customFactory);
  });

  it("creates a default worker receiver server adapter", () => {
    const server = createDefaultWorkerReceiverServer(() => undefined);

    expect(typeof server.listen).toBe("function");
    expect(typeof server.close).toBe("function");
    server.close();
  });

  it("writes JSON responses through the node listener", async () => {
    const listener = createWorkerReceiverListener({
      idempotencyStore: new InMemoryWorkerIdempotencyStore(),
      runJob: () => Promise.resolve(successfulResult),
    });
    const setHeader = vi.fn();
    const end = vi.fn();
    const events = new Map<string, (...args: unknown[]) => void>();
    const request = {
      headers: {
        "x-test": ["one", "two"],
        "x-test-single": "value",
      },
      method: "POST",
      on: (
        event: "data" | "end" | "error",
        callback:
          | ((chunk: string | Uint8Array) => void)
          | (() => void)
          | ((error: Error) => void),
      ) => {
        events.set(event, callback as (...args: unknown[]) => void);
        return request as never;
      },
      url: "/worker",
    };

    listener(
      request as unknown as never,
      {
        end,
        setHeader,
      } as unknown as never,
    );
    events.get("data")?.(JSON.stringify({ kind: "sync_all" }));
    events.get("end")?.();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(setHeader).toHaveBeenCalledWith(
      "content-type",
      "application/json; charset=utf-8",
    );
    expect(end).toHaveBeenCalled();
  });

  it("reads binary request chunks and falls back to default method/url values", async () => {
    const listener = createWorkerReceiverListener({
      idempotencyStore: new InMemoryWorkerIdempotencyStore(),
      runJob: () => Promise.resolve(successfulResult),
    });
    const end = vi.fn();
    const setHeader = vi.fn();
    const events = new Map<string, (...args: unknown[]) => void>();
    const request = {
      headers: {},
      method: undefined,
      on: (
        event: "data" | "end" | "error",
        callback:
          | ((chunk: string | Uint8Array) => void)
          | (() => void)
          | ((error: Error) => void),
      ) => {
        events.set(event, callback as (...args: unknown[]) => void);
        return request as never;
      },
      url: undefined,
    };

    listener(
      request as unknown as never,
      {
        end,
        setHeader,
      } as unknown as never,
    );
    events
      .get("data")
      ?.(new TextEncoder().encode(JSON.stringify({ kind: "sync_all" })));
    events.get("end")?.();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(setHeader).toHaveBeenCalled();
    expect(end).toHaveBeenCalled();
  });

  it("ignores request-body read failures without writing a response", async () => {
    const listener = createWorkerReceiverListener({
      idempotencyStore: new InMemoryWorkerIdempotencyStore(),
      runJob: () => Promise.resolve(successfulResult),
    });
    const end = vi.fn();
    const setHeader = vi.fn();
    const events = new Map<string, (...args: unknown[]) => void>();
    const request = {
      headers: {
        "x-test": ["one", "two"],
      },
      method: "POST",
      on: (
        event: "data" | "end" | "error",
        callback:
          | ((chunk: string | Uint8Array) => void)
          | (() => void)
          | ((error: Error) => void),
      ) => {
        events.set(event, callback as (...args: unknown[]) => void);
        return request as never;
      },
      url: "/worker",
    };

    listener(
      request as unknown as never,
      {
        end,
        setHeader,
      } as unknown as never,
    );
    events.get("error")?.(new Error("stream failed"));
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(setHeader).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });

  it("starts and stops the receiver through the injected server factory", async () => {
    const listen = vi.fn((_port: number, _hostname: string, callback?: () => void) => {
      callback?.();
    });
    const close = vi.fn((callback?: () => void) => {
      callback?.();
    });

    const started = await startWorkerReceiverServer({
      dependencies: {
        idempotencyStore: new InMemoryWorkerIdempotencyStore(),
        runJob: () => Promise.resolve(successfulResult),
      },
      serverFactory: () =>
        ({
          close,
          listen,
        }) as const,
    });

    expect(started.port).toBe(8787);
    await started.close();
    expect(listen).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
