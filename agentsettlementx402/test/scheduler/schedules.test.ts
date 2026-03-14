import { describe, expect, it, vi } from "vitest";

vi.mock("@upstash/qstash", () => {
  class MockClient {
    public readonly schedules = {
      create: (request: {
        body: string;
        cron: string;
        destination: string;
        method: "POST";
        scheduleId: string;
      }) =>
        Promise.resolve({
          scheduleId: request.scheduleId,
        }),
      delete: (_scheduleId: string) => Promise.resolve(),
      get: (scheduleId: string) =>
        scheduleId === "missing"
          ? Promise.reject(new Error("missing"))
          : scheduleId === "null-body"
            ? Promise.resolve({
                body: { kind: "sync_all" },
                cron: "*/5 * * * *",
                destination: "https://example.com/internal/worker",
                method: undefined,
                scheduleId,
              })
            : Promise.resolve({
                body: "{\"kind\":\"sync_all\"}",
                cron: "*/5 * * * *",
                destination: "https://example.com/internal/worker",
                method: "POST",
                scheduleId,
              }),
    };
  }

  return {
    Client: MockClient,
  };
});

import {
  createQstashScheduleClient,
  ensureWorkerSchedule,
} from "../../src/scheduler/schedules.js";

const baseDefinition = {
  body: {
    kind: "sync_all" as const,
  },
  cron: "*/5 * * * *",
  destination: "https://example.com/internal/worker",
  method: "POST" as const,
  scheduleId: "sync",
};

describe("ensureWorkerSchedule", () => {
  it("creates missing schedules", async () => {
    const createCalls: unknown[] = [];

    await expect(
      ensureWorkerSchedule(baseDefinition, {
        create: (definition) => {
          createCalls.push(definition);
          return Promise.resolve({ scheduleId: definition.scheduleId });
        },
        delete: () => Promise.resolve(),
        get: () => Promise.resolve(null),
      }),
    ).resolves.toEqual({
      action: "created",
      scheduleId: "sync",
    });
    expect(createCalls).toHaveLength(1);
  });

  it("returns noop when the existing schedule already matches", async () => {
    await expect(
      ensureWorkerSchedule(baseDefinition, {
        create: () => Promise.resolve({ scheduleId: "sync" }),
        delete: () => Promise.resolve(),
        get: () =>
          Promise.resolve({
            body: JSON.stringify(baseDefinition.body),
            cron: baseDefinition.cron,
            destination: baseDefinition.destination,
            method: baseDefinition.method,
            scheduleId: baseDefinition.scheduleId,
          }),
      }),
    ).resolves.toEqual({
      action: "noop",
      scheduleId: "sync",
    });
  });

  it("replaces schedules when the existing definition differs", async () => {
    const deleted: string[] = [];

    await expect(
      ensureWorkerSchedule(baseDefinition, {
        create: (definition) => Promise.resolve({ scheduleId: definition.scheduleId }),
        delete: (scheduleId) => {
          deleted.push(scheduleId);
          return Promise.resolve();
        },
        get: () =>
          Promise.resolve({
            body: "{}",
            cron: "*/10 * * * *",
            destination: baseDefinition.destination,
            method: baseDefinition.method,
            scheduleId: baseDefinition.scheduleId,
          }),
      }),
    ).resolves.toEqual({
      action: "updated",
      scheduleId: "sync",
    });
    expect(deleted).toEqual(["sync"]);
  });

  it("treats null stored body and method values as mismatches", async () => {
    await expect(
      ensureWorkerSchedule(baseDefinition, {
        create: (definition) => Promise.resolve({ scheduleId: definition.scheduleId }),
        delete: () => Promise.resolve(),
        get: () =>
          Promise.resolve({
            body: null,
            cron: baseDefinition.cron,
            destination: baseDefinition.destination,
            method: null,
            scheduleId: baseDefinition.scheduleId,
          }),
      }),
    ).resolves.toEqual({
      action: "updated",
      scheduleId: "sync",
    });
  });
});

describe("createQstashScheduleClient", () => {
  it("constructs a qstash schedule client adapter with create/get/delete wrappers", async () => {
    const client = createQstashScheduleClient("token");

    await expect(
      client.create({
        body: "{\"kind\":\"sync_all\"}",
        cron: "*/5 * * * *",
        destination: "https://example.com/internal/worker",
        method: "POST",
        scheduleId: "sync",
      }),
    ).resolves.toEqual({
      scheduleId: "sync",
    });
    await expect(client.get("sync")).resolves.toEqual({
      body: "{\"kind\":\"sync_all\"}",
      cron: "*/5 * * * *",
      destination: "https://example.com/internal/worker",
      method: "POST",
      scheduleId: "sync",
    });
    await expect(client.get("null-body")).resolves.toEqual({
      body: null,
      cron: "*/5 * * * *",
      destination: "https://example.com/internal/worker",
      method: null,
      scheduleId: "null-body",
    });
    await expect(client.get("missing")).resolves.toBeNull();
    await expect(client.delete("sync")).resolves.toBeUndefined();
  });
});
