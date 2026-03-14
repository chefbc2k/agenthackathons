import { describe, expect, it, vi } from "vitest";

import {
  buildWorkerJobFromConfig,
  runWorkerFromEnvironment,
  startWorkerReceiverFromEnvironment,
} from "../../src/worker/cli.js";
import * as receiverModule from "../../src/worker/receiver.js";

describe("worker cli helpers", () => {
  it("reads an empty default runtime environment when process is unavailable", () => {
    vi.stubGlobal("process", { env: undefined });

    expect(buildWorkerJobFromConfig()).toEqual({
      agentDomains: [],
      facilitatorBaseUrl: null,
      kind: "sync_all",
    });

    vi.unstubAllGlobals();
  });

  it("builds worker jobs from environment config", () => {
    vi.stubGlobal("process", {
      env: {
        A2A_AGENT_DOMAINS: "example.com",
        X402_BAZAAR_FACILITATOR_URL: "https://facilitator.example.com",
      },
    });

    expect(buildWorkerJobFromConfig()).toEqual({
      agentDomains: ["example.com"],
      facilitatorBaseUrl: "https://facilitator.example.com",
      kind: "sync_all",
    });

    vi.unstubAllGlobals();
  });

  it("runs the worker once from environment", async () => {
    vi.stubGlobal("process", {
      env: {},
    });

    await expect(runWorkerFromEnvironment()).resolves.toMatchObject({
      stages: {
        a2a: {
          skipped: true,
        },
      },
    });

    vi.unstubAllGlobals();
  });

  it("requires redis credentials before starting the receiver", async () => {
    vi.stubGlobal("process", {
      env: {},
    });

    await expect(startWorkerReceiverFromEnvironment()).rejects.toThrow(
      "Redis REST credentials are required for the worker receiver",
    );

    vi.unstubAllGlobals();
  });

  it("starts the receiver from environment when redis credentials are present", async () => {
    const startSpy = vi
      .spyOn(receiverModule, "startWorkerReceiverServer")
      .mockResolvedValue({
        close: () => Promise.resolve(),
        port: 9090,
      });

    vi.stubGlobal("process", {
      env: {
        KV_REST_API_TOKEN: "token",
        KV_REST_API_URL: "https://example.upstash.io",
        QSTASH_CURRENT_SIGNING_KEY: "current",
        QSTASH_NEXT_SIGNING_KEY: "next",
        WORKER_RECEIVER_PORT: "9090",
      },
    });

    const started = await startWorkerReceiverFromEnvironment();

    expect(typeof started.close).toBe("function");
    expect(started.port).toBe(9090);
    expect(startSpy).toHaveBeenCalledOnce();
    await expect(
      startSpy.mock.calls[0]?.[0].dependencies.runJob({
        kind: "sync_all",
      }),
    ).resolves.toMatchObject({
      stages: {
        a2a: {
          skipped: true,
        },
      },
    });

    startSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("starts the receiver without attaching a verifier when signing keys are absent", async () => {
    const startSpy = vi
      .spyOn(receiverModule, "startWorkerReceiverServer")
      .mockResolvedValue({
        close: () => Promise.resolve(),
        port: 8787,
      });

    vi.stubGlobal("process", {
      env: {
        KV_REST_API_TOKEN: "token",
        KV_REST_API_URL: "https://example.upstash.io",
      },
    });

    await startWorkerReceiverFromEnvironment();
    expect(startSpy.mock.calls[0]?.[0].dependencies).not.toHaveProperty("verifier");

    startSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
