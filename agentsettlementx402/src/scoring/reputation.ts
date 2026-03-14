import type { ObservableMetrics } from "../metrics/observable.js";

export const reputationEvidenceTypes = [
  "bazaar_declaration",
  "payment_required",
  "settlement_response",
  "a2a_x402_receipt",
] as const;

export type ReputationEvidenceType = (typeof reputationEvidenceTypes)[number];

export const reputationConfidenceTiers = ["low", "medium", "high"] as const;

export type ReputationConfidenceTier =
  (typeof reputationConfidenceTiers)[number];

export interface ReputationScoreInput {
  readonly agentId: string;
  readonly evidenceTypes: readonly ReputationEvidenceType[];
  readonly metrics: ObservableMetrics;
  readonly serviceId: string;
}

export interface ReputationScoreExplanation {
  readonly diversityFactor: number;
  readonly inferenceLabel: "inference";
  readonly observableAttemptCount: number;
  readonly payerDiversityRatio: number;
  readonly rawSuccessRate: number | null;
  readonly recencyFactor: number;
  readonly retryPenalty: number;
  readonly weightedSuccessRate: number;
}

export interface ReputationScoreResult {
  readonly agentId: string;
  readonly confidenceTier: ReputationConfidenceTier;
  readonly explanation: ReputationScoreExplanation;
  readonly inferenceLabel: "inference";
  readonly score: number;
  readonly serviceId: string;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const countDistinctEvidence = (
  evidenceTypes: readonly ReputationEvidenceType[],
): number => {
  return new Set(evidenceTypes).size;
};

export const getScoreConfidenceTier = (
  evidenceTypes: readonly ReputationEvidenceType[],
): ReputationConfidenceTier => {
  if (evidenceTypes.includes("a2a_x402_receipt")) {
    return "high";
  }

  if (
    evidenceTypes.includes("settlement_response") ||
    evidenceTypes.includes("payment_required")
  ) {
    return "medium";
  }

  return "low";
};

export const computeRecencyFactor = (metrics: ObservableMetrics): number => {
  const recentWeight = metrics.recency.eventCount7d;
  const monthWeight = metrics.recency.eventCount30d;

  if (monthWeight === 0) {
    return 0;
  }

  return clamp((recentWeight * 2 + monthWeight) / (monthWeight * 3), 0, 1);
};

export const computeRetryPenalty = (metrics: ObservableMetrics): number => {
  const averageAttempts =
    metrics.derivedProxies.retryIntensity.averageAttemptsPerGroup ?? 1;
  return clamp((averageAttempts - 1) * 0.25, 0, 0.5);
};

export const computeDiversityFactor = (metrics: ObservableMetrics): number => {
  if (metrics.usage.eventCount === 0) {
    return 0;
  }

  return clamp(metrics.usage.uniquePayerCount / metrics.usage.eventCount, 0, 1);
};

export const scoreReputation = (
  input: ReputationScoreInput,
): ReputationScoreResult => {
  const recencyFactor = computeRecencyFactor(input.metrics);
  const retryPenalty = computeRetryPenalty(input.metrics);
  const diversityFactor = computeDiversityFactor(input.metrics);
  const rawSuccessRate = input.metrics.success.successRate;
  const weightedSuccessRate = rawSuccessRate ?? 0;
  const evidenceCount = countDistinctEvidence(input.evidenceTypes);
  const evidenceFactor = clamp(0.5 + evidenceCount * 0.1, 0.5, 0.9);
  const score = clamp(
    weightedSuccessRate * 70 +
      recencyFactor * 15 +
      diversityFactor * 10 +
      evidenceFactor * 5 -
      retryPenalty * 20,
    0,
    100,
  );

  return {
    agentId: input.agentId,
    confidenceTier: getScoreConfidenceTier(input.evidenceTypes),
    explanation: {
      diversityFactor,
      inferenceLabel: "inference",
      observableAttemptCount: input.metrics.success.observableAttemptCount,
      payerDiversityRatio: diversityFactor,
      rawSuccessRate,
      recencyFactor,
      retryPenalty,
      weightedSuccessRate,
    },
    inferenceLabel: "inference",
    score,
    serviceId: input.serviceId,
  };
};
