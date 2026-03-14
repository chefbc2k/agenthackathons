import { describe, expect, it } from "vitest";

import { computeMetrics } from "../../src/metrics/observable.js";

describe("computeMetrics", () => {
  it("computes observable usage, success, retry, and recency metrics deterministically", () => {
    const now = new Date("2026-03-13T12:00:00.000Z");

    expect(
      computeMetrics({
        agentId: "agent-1",
        now,
        observations: [
          {
            groupKey: "payment-1",
            occurredAt: new Date("2026-03-13T11:00:00.000Z"),
            outcome: "success",
            payerId: "payer-1",
          },
          {
            groupKey: "payment-1",
            occurredAt: new Date("2026-03-13T11:05:00.000Z"),
            outcome: "failure",
            payerId: "payer-1",
          },
          {
            groupKey: "task-2",
            occurredAt: new Date("2026-03-10T12:00:00.000Z"),
            outcome: "unknown",
            payerId: "payer-2",
          },
          {
            groupKey: null,
            occurredAt: new Date("2026-02-20T12:00:00.000Z"),
            outcome: "failure",
            payerId: null,
          },
        ],
        serviceId: "service-1",
      }),
    ).toEqual({
      agentId: "agent-1",
      asOf: now,
      derivedProxies: {
        retryIntensity: {
          attemptsWithGroupKey: 3,
          averageAttemptsPerGroup: 1.5,
          groupedAttemptCount: 2,
          groupsWithRetries: 1,
        },
      },
      recency: {
        eventCount7d: 3,
        eventCount30d: 4,
        uniquePayerCount7d: 2,
        uniquePayerCount30d: 2,
      },
      serviceId: "service-1",
      success: {
        failureCount: 2,
        observableAttemptCount: 3,
        successCount: 1,
        successRate: 1 / 3,
      },
      usage: {
        eventCount: 4,
        uniquePayerCount: 2,
      },
    });
  });

  it("returns null rates and zero retry averages when no observable grouped attempts exist", () => {
    const now = new Date("2026-03-13T12:00:00.000Z");

    expect(
      computeMetrics({
        agentId: "agent-1",
        now,
        observations: [
          {
            groupKey: null,
            occurredAt: new Date("2026-01-01T00:00:00.000Z"),
            outcome: "unknown",
            payerId: null,
          },
        ],
        serviceId: "service-1",
      }),
    ).toEqual({
      agentId: "agent-1",
      asOf: now,
      derivedProxies: {
        retryIntensity: {
          attemptsWithGroupKey: 0,
          averageAttemptsPerGroup: null,
          groupedAttemptCount: 0,
          groupsWithRetries: 0,
        },
      },
      recency: {
        eventCount7d: 0,
        eventCount30d: 0,
        uniquePayerCount7d: 0,
        uniquePayerCount30d: 0,
      },
      serviceId: "service-1",
      success: {
        failureCount: 0,
        observableAttemptCount: 0,
        successCount: 0,
        successRate: null,
      },
      usage: {
        eventCount: 1,
        uniquePayerCount: 0,
      },
    });
  });
});
