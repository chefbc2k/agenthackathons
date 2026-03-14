import { describe, expect, it, vi } from "vitest";

import {
  WorkerConfigError,
  loadWorkerConfig,
  minutesToCronExpression,
  resolveWorkerScheduleCron,
} from "../../src/worker/config.js";

describe("worker config", () => {
  it("loads worker runtime config from environment", () => {
    expect(
      loadWorkerConfig({
        A2A_AGENT_DOMAINS: "example.com, another.example ",
        QSTASH_CURRENT_SIGNING_KEY: "current",
        QSTASH_NEXT_SIGNING_KEY: "next",
        QSTASH_SCHEDULE_DESTINATION: "https://example.com/internal/worker",
        QSTASH_TOKEN: "token",
        WORKER_RECEIVER_PORT: "9090",
        WORKER_SCHEDULE_MINUTES: "5",
        X402_BAZAAR_FACILITATOR_URL: "https://facilitator.example.com",
      }),
    ).toEqual({
      agentDomains: ["example.com", "another.example"],
      bazaarFacilitatorBaseUrl: "https://facilitator.example.com",
      qstash: {
        currentSigningKey: "current",
        destination: "https://example.com/internal/worker",
        enabled: true,
        nextSigningKey: "next",
        scheduleCron: "*/5 * * * *",
        scheduleEveryMinutes: 5,
        token: "token",
      },
      receiverPort: 9090,
    });
  });

  it("prefers explicit cron expressions over generated minute cron", () => {
    expect(
      resolveWorkerScheduleCron({
        A2A_AGENT_DOMAINS: null,
        QSTASH_CURRENT_SIGNING_KEY: null,
        QSTASH_NEXT_SIGNING_KEY: null,
        QSTASH_SCHEDULE_CRON: "*/10 * * * *",
        QSTASH_SCHEDULE_DESTINATION: null,
        QSTASH_TOKEN: null,
        WORKER_RECEIVER_PORT: null,
        WORKER_SCHEDULE_MINUTES: 5,
        X402_BAZAAR_FACILITATOR_URL: null,
      }),
    ).toBe("*/10 * * * *");
  });

  it("fails when destination exists without a cron expression or minute interval", () => {
    expect(() =>
      loadWorkerConfig({
        QSTASH_SCHEDULE_DESTINATION: "https://example.com/internal/worker",
      }),
    ).toThrowError(
      new WorkerConfigError([
        "QSTASH_SCHEDULE_DESTINATION: Provide QSTASH_SCHEDULE_CRON or WORKER_SCHEDULE_MINUTES",
      ]),
    );
  });

  it("fails when cron or minute interval exists without destination", () => {
    expect(() =>
      loadWorkerConfig({
        WORKER_SCHEDULE_MINUTES: "5",
      }),
    ).toThrowError(
      new WorkerConfigError([
        "QSTASH_SCHEDULE_DESTINATION: Required when schedule cron or minutes are configured",
      ]),
    );
  });

  it("validates minute interval bounds", () => {
    expect(minutesToCronExpression(15)).toBe("*/15 * * * *");
    expect(() => minutesToCronExpression(0)).toThrowError(
      new WorkerConfigError([
        "WORKER_SCHEDULE_MINUTES: Expected an integer between 1 and 59",
      ]),
    );
  });

  it("reads from the default runtime environment and reports schema failures", () => {
    vi.stubGlobal("process", undefined);
    expect(loadWorkerConfig()).toEqual({
      agentDomains: [],
      bazaarFacilitatorBaseUrl: null,
      qstash: {
        currentSigningKey: null,
        destination: null,
        enabled: false,
        nextSigningKey: null,
        scheduleCron: null,
        scheduleEveryMinutes: null,
        token: null,
      },
      receiverPort: 8787,
    });

    vi.stubGlobal("process", {
      env: {
        A2A_AGENT_DOMAINS: "   ",
        WORKER_RECEIVER_PORT: "bad",
      },
    });
    expect(() => loadWorkerConfig()).toThrowError(
      new WorkerConfigError([
        "WORKER_RECEIVER_PORT: Invalid input: expected number, received NaN",
      ]),
    );
    vi.unstubAllGlobals();
  });
});
