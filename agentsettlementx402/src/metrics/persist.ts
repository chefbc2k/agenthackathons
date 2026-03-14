import { hashStableJson } from "../core/stable-json.js";
import type {
  ObservableMetricsRecord,
  ObservableMetricsRepository,
} from "../db/repositories.js";
import type { ObservableMetrics } from "./observable.js";

export class ObservableMetricsPersistenceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ObservableMetricsPersistenceError";
  }
}

export interface PersistedObservableMetricsResult {
  readonly action: "created" | "updated" | "noop";
  readonly fingerprint: string;
  readonly record: ObservableMetricsRecord;
}

const ensurePersistableMetrics = (metrics: ObservableMetrics): ObservableMetrics => {
  if (metrics.agentId.length === 0) {
    throw new ObservableMetricsPersistenceError("Observable metrics agentId is required");
  }

  if (metrics.serviceId.length === 0) {
    throw new ObservableMetricsPersistenceError("Observable metrics serviceId is required");
  }

  return metrics;
};

export const persistComputedMetrics = async (
  metrics: ObservableMetrics,
  repository: ObservableMetricsRepository,
): Promise<PersistedObservableMetricsResult> => {
  const persistable = ensurePersistableMetrics(metrics);
  const fingerprint = hashStableJson(persistable);
  const existing = await repository.findByAgentAndService(
    persistable.agentId,
    persistable.serviceId,
  );

  if (existing && existing.metricsFingerprint === fingerprint) {
    return {
      action: "noop",
      fingerprint,
      record: existing,
    };
  }

  const record = await repository.upsert({
    agentId: persistable.agentId,
    asOf: persistable.asOf,
    derivedProxies: persistable.derivedProxies,
    metricsFingerprint: fingerprint,
    recency: persistable.recency,
    serviceId: persistable.serviceId,
    success: persistable.success,
    usage: persistable.usage,
  });

  return {
    action: existing ? "updated" : "created",
    fingerprint,
    record,
  };
};
