import { describe, expect, it } from "vitest";

import {
  computeDiversityFactor,
  computeRecencyFactor,
  computeRetryPenalty,
  getScoreConfidenceTier,
  reputationConfidenceTiers,
  reputationEvidenceTypes,
  scoreReputation,
} from "../../src/scoring/reputation.js";

const baseMetrics = {
  agentId: "agent-1",
  asOf: new Date("2026-03-13T12:00:00.000Z"),
  derivedProxies: {
    retryIntensity: {
      attemptsWithGroupKey: 2,
      averageAttemptsPerGroup: 1,
      groupedAttemptCount: 2,
      groupsWithRetries: 0,
    },
  },
  recency: {
    eventCount7d: 10,
    eventCount30d: 20,
    uniquePayerCount7d: 5,
    uniquePayerCount30d: 8,
  },
  serviceId: "service-1",
  success: {
    failureCount: 2,
    observableAttemptCount: 10,
    successCount: 8,
    successRate: 0.8,
  },
  usage: {
    eventCount: 20,
    uniquePayerCount: 8,
  },
} as const;

describe("reputation constants", () => {
  it("exposes stable evidence and confidence enums", () => {
    expect(reputationEvidenceTypes).toEqual([
      "bazaar_declaration",
      "payment_required",
      "settlement_response",
      "a2a_x402_receipt",
    ]);
    expect(reputationConfidenceTiers).toEqual(["low", "medium", "high"]);
  });
});

describe("score helpers", () => {
  it("derives confidence tiers from evidence availability", () => {
    expect(getScoreConfidenceTier(["bazaar_declaration"])).toBe("low");
    expect(getScoreConfidenceTier(["payment_required"])).toBe("medium");
    expect(getScoreConfidenceTier(["a2a_x402_receipt"])).toBe("high");
  });

  it("computes recency, retry, and diversity factors deterministically", () => {
    expect(computeRecencyFactor(baseMetrics)).toBe(2 / 3);
    expect(computeRetryPenalty(baseMetrics)).toBe(0);
    expect(computeDiversityFactor(baseMetrics)).toBe(0.4);
  });

  it("returns zero recency and diversity when there is no activity", () => {
    const emptyMetrics = {
      ...baseMetrics,
      recency: {
        eventCount7d: 0,
        eventCount30d: 0,
        uniquePayerCount7d: 0,
        uniquePayerCount30d: 0,
      },
      usage: {
        eventCount: 0,
        uniquePayerCount: 0,
      },
    };

    expect(computeRecencyFactor(emptyMetrics)).toBe(0);
    expect(computeDiversityFactor(emptyMetrics)).toBe(0);
  });

  it("increases retry penalty monotonically with average attempts per group", () => {
    const lowRetry = computeRetryPenalty(baseMetrics);
    const highRetry = computeRetryPenalty({
      ...baseMetrics,
      derivedProxies: {
        retryIntensity: {
          attemptsWithGroupKey: 6,
          averageAttemptsPerGroup: 3,
          groupedAttemptCount: 2,
          groupsWithRetries: 2,
        },
      },
    });

    expect(highRetry).toBeGreaterThan(lowRetry);
  });
});

describe("scoreReputation", () => {
  it("returns a deterministic explained inference score", () => {
    expect(
      scoreReputation({
        agentId: "agent-1",
        evidenceTypes: ["payment_required", "settlement_response"],
        metrics: baseMetrics,
        serviceId: "service-1",
      }),
    ).toEqual({
      agentId: "agent-1",
      confidenceTier: "medium",
      explanation: {
        diversityFactor: 0.4,
        inferenceLabel: "inference",
        observableAttemptCount: 10,
        payerDiversityRatio: 0.4,
        rawSuccessRate: 0.8,
        recencyFactor: 2 / 3,
        retryPenalty: 0,
        weightedSuccessRate: 0.8,
      },
      inferenceLabel: "inference",
      score: 73.5,
      serviceId: "service-1",
    });
  });

  it("is monotone with success rate when other inputs are held constant", () => {
    const low = scoreReputation({
      agentId: "agent-1",
      evidenceTypes: ["payment_required"],
      metrics: {
        ...baseMetrics,
        success: {
          failureCount: 8,
          observableAttemptCount: 10,
          successCount: 2,
          successRate: 0.2,
        },
      },
      serviceId: "service-1",
    });
    const high = scoreReputation({
      agentId: "agent-1",
      evidenceTypes: ["payment_required"],
      metrics: {
        ...baseMetrics,
        success: {
          failureCount: 2,
          observableAttemptCount: 10,
          successCount: 8,
          successRate: 0.8,
        },
      },
      serviceId: "service-1",
    });

    expect(high.score).toBeGreaterThan(low.score);
  });

  it("penalizes high retry intensity", () => {
    const lowRetry = scoreReputation({
      agentId: "agent-1",
      evidenceTypes: ["payment_required"],
      metrics: baseMetrics,
      serviceId: "service-1",
    });
    const highRetry = scoreReputation({
      agentId: "agent-1",
      evidenceTypes: ["payment_required"],
      metrics: {
        ...baseMetrics,
        derivedProxies: {
          retryIntensity: {
            attemptsWithGroupKey: 9,
            averageAttemptsPerGroup: 3,
            groupedAttemptCount: 3,
            groupsWithRetries: 3,
          },
        },
      },
      serviceId: "service-1",
    });

    expect(highRetry.score).toBeLessThan(lowRetry.score);
  });

  it("handles no data, all failures, conflicting signals, and all successes deterministically", () => {
    const noData = scoreReputation({
      agentId: "agent-1",
      evidenceTypes: [],
      metrics: {
        ...baseMetrics,
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
        success: {
          failureCount: 0,
          observableAttemptCount: 0,
          successCount: 0,
          successRate: null,
        },
        usage: {
          eventCount: 0,
          uniquePayerCount: 0,
        },
      },
      serviceId: "service-1",
    });
    const allFailures = scoreReputation({
      agentId: "agent-1",
      evidenceTypes: ["settlement_response"],
      metrics: {
        ...baseMetrics,
        success: {
          failureCount: 10,
          observableAttemptCount: 10,
          successCount: 0,
          successRate: 0,
        },
      },
      serviceId: "service-1",
    });
    const conflicting = scoreReputation({
      agentId: "agent-1",
      evidenceTypes: ["payment_required", "bazaar_declaration"],
      metrics: {
        ...baseMetrics,
        derivedProxies: {
          retryIntensity: {
            attemptsWithGroupKey: 8,
            averageAttemptsPerGroup: 4,
            groupedAttemptCount: 2,
            groupsWithRetries: 2,
          },
        },
        success: {
          failureCount: 1,
          observableAttemptCount: 2,
          successCount: 1,
          successRate: 0.5,
        },
      },
      serviceId: "service-1",
    });
    const allSuccess = scoreReputation({
      agentId: "agent-1",
      evidenceTypes: ["a2a_x402_receipt"],
      metrics: {
        ...baseMetrics,
        success: {
          failureCount: 0,
          observableAttemptCount: 10,
          successCount: 10,
          successRate: 1,
        },
      },
      serviceId: "service-1",
    });

    expect(noData.score).toBe(2.5);
    expect(noData.confidenceTier).toBe("low");
    expect(allFailures.score).toBeLessThan(conflicting.score);
    expect(conflicting.score).toBeLessThan(allSuccess.score);
    expect(allSuccess.confidenceTier).toBe("high");
  });
});
