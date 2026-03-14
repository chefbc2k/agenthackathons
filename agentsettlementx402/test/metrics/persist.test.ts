import { describe, expect, it, vi } from "vitest";

import { hashStableJson } from "../../src/core/stable-json.js";
import type { ObservableMetricsRepository } from "../../src/db/repositories.js";
import {
  ObservableMetricsPersistenceError,
  persistComputedMetrics,
} from "../../src/metrics/persist.js";

const baseMetrics = {
  agentId: "agent-1",
  asOf: new Date("2026-03-13T12:00:00.000Z"),
  derivedProxies: {
    retryIntensity: {
      attemptsWithGroupKey: 2,
      averageAttemptsPerGroup: 2,
      groupedAttemptCount: 1,
      groupsWithRetries: 1,
    },
  },
  recency: {
    eventCount7d: 2,
    eventCount30d: 4,
    uniquePayerCount7d: 1,
    uniquePayerCount30d: 2,
  },
  serviceId: "service-1",
  success: {
    failureCount: 1,
    observableAttemptCount: 2,
    successCount: 1,
    successRate: 0.5,
  },
  usage: {
    eventCount: 4,
    uniquePayerCount: 2,
  },
} as const;

const createRepository = ({
  existing,
}: {
  readonly existing: Awaited<
    ReturnType<ObservableMetricsRepository["findByAgentAndService"]>
  >;
}) => {
  const upsert = vi
    .fn<
      (
        input: Parameters<ObservableMetricsRepository["upsert"]>[0],
      ) => Promise<Awaited<ReturnType<ObservableMetricsRepository["upsert"]>>>
    >()
    .mockImplementation((input) => Promise.resolve(input));
  const repository: ObservableMetricsRepository = {
    findByAgentAndService: vi.fn().mockResolvedValue(existing),
    upsert,
  };

  return {
    repository,
    upsert,
  };
};

describe("persistComputedMetrics", () => {
  it("creates a new snapshot when none exists", async () => {
    const { repository } = createRepository({
      existing: null,
    });

    await expect(persistComputedMetrics(baseMetrics, repository)).resolves.toEqual({
      action: "created",
      fingerprint: hashStableJson(baseMetrics),
      record: {
        ...baseMetrics,
        metricsFingerprint: hashStableJson(baseMetrics),
      },
    });
  });

  it("updates an existing snapshot when the fingerprint changes", async () => {
    const { repository, upsert } = createRepository({
      existing: {
        ...baseMetrics,
        metricsFingerprint: "old-fingerprint",
      },
    });

    await expect(persistComputedMetrics(baseMetrics, repository)).resolves.toMatchObject({
      action: "updated",
      fingerprint: hashStableJson(baseMetrics),
    });
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("returns a no-op when the fingerprint is unchanged", async () => {
    const existing = {
      ...baseMetrics,
      metricsFingerprint: hashStableJson(baseMetrics),
    };
    const { repository, upsert } = createRepository({
      existing,
    });

    await expect(persistComputedMetrics(baseMetrics, repository)).resolves.toEqual({
      action: "noop",
      fingerprint: hashStableJson(baseMetrics),
      record: existing,
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects invalid metrics before repository access", async () => {
    const { repository } = createRepository({
      existing: null,
    });

    await expect(
      persistComputedMetrics(
        {
          ...baseMetrics,
          agentId: "",
        },
        repository,
      ),
    ).rejects.toThrowError(ObservableMetricsPersistenceError);
  });

  it("rejects metrics with a missing service id before repository access", async () => {
    const { repository } = createRepository({
      existing: null,
    });

    await expect(
      persistComputedMetrics(
        {
          ...baseMetrics,
          serviceId: "",
        },
        repository,
      ),
    ).rejects.toThrowError(ObservableMetricsPersistenceError);
  });
});
