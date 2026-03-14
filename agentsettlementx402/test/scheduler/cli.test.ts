import { describe, expect, it, vi } from "vitest";

describe("scheduler cli", () => {
  it("reads an empty default environment when process is unavailable", async () => {
    vi.stubGlobal("process", { env: undefined });

    const { ensureScheduleFromEnvironment } = await import(
      "../../src/scheduler/cli.js"
    );

    await expect(ensureScheduleFromEnvironment()).rejects.toThrow(
      "QSTASH_TOKEN is required to create schedules",
    );

    vi.unstubAllGlobals();
  });

  it("requires qstash token and schedule configuration", async () => {
    const { ensureScheduleFromEnvironment } = await import(
      "../../src/scheduler/cli.js"
    );
    vi.stubGlobal("process", {
      env: {},
    });

    await expect(ensureScheduleFromEnvironment()).rejects.toThrow(
      "QSTASH_TOKEN is required to create schedules",
    );

    vi.unstubAllGlobals();
  });

  it("requires destination and cron when qstash token exists", async () => {
    const { ensureScheduleFromEnvironment } = await import(
      "../../src/scheduler/cli.js"
    );
    vi.stubGlobal("process", {
      env: {
        QSTASH_TOKEN: "token",
      },
    });

    await expect(ensureScheduleFromEnvironment()).rejects.toThrow(
      "QStash destination and schedule cron are required",
    );

    vi.unstubAllGlobals();
  });

  it("creates schedules from environment when config is complete", async () => {
    vi.resetModules();
    vi.doMock("../../src/scheduler/schedules.js", () => ({
      createQstashScheduleClient: () => ({
        create: () => Promise.resolve({ scheduleId: "sync" }),
        delete: () => Promise.resolve(),
        get: () => Promise.resolve(null),
      }),
      ensureWorkerSchedule: () =>
        Promise.resolve({
          action: "created",
          scheduleId: "sync",
        }),
    }));

    vi.stubGlobal("process", {
      env: {
        A2A_AGENT_DOMAINS: "example.com",
        QSTASH_SCHEDULE_DESTINATION: "https://example.com/internal/worker",
        QSTASH_TOKEN: "token",
        WORKER_SCHEDULE_MINUTES: "5",
      },
    });

    const { ensureScheduleFromEnvironment } = await import(
      "../../src/scheduler/cli.js"
    );

    await expect(ensureScheduleFromEnvironment()).resolves.toEqual({
      action: "created",
      scheduleId: "sync",
    });

    vi.unstubAllGlobals();
    vi.doUnmock("../../src/scheduler/schedules.js");
  });
});
