export type ObservableAttemptOutcome = "success" | "failure" | "unknown";

export interface ObservableMetricEvent {
  readonly groupKey: string | null;
  readonly occurredAt: Date;
  readonly outcome: ObservableAttemptOutcome;
  readonly payerId: string | null;
}

export interface ObservableMetricsInput {
  readonly agentId: string;
  readonly now: Date;
  readonly observations: readonly ObservableMetricEvent[];
  readonly serviceId: string;
}

export interface ObservableUsageMetrics {
  readonly eventCount: number;
  readonly uniquePayerCount: number;
}

export interface ObservableRecencyMetrics {
  readonly eventCount7d: number;
  readonly eventCount30d: number;
  readonly uniquePayerCount7d: number;
  readonly uniquePayerCount30d: number;
}

export interface ObservableSuccessMetrics {
  readonly failureCount: number;
  readonly observableAttemptCount: number;
  readonly successCount: number;
  readonly successRate: number | null;
}

export interface ObservableRetryProxyMetrics {
  readonly attemptsWithGroupKey: number;
  readonly averageAttemptsPerGroup: number | null;
  readonly groupedAttemptCount: number;
  readonly groupsWithRetries: number;
}

export interface ObservableMetrics {
  readonly agentId: string;
  readonly asOf: Date;
  readonly derivedProxies: {
    readonly retryIntensity: ObservableRetryProxyMetrics;
  };
  readonly recency: ObservableRecencyMetrics;
  readonly serviceId: string;
  readonly success: ObservableSuccessMetrics;
  readonly usage: ObservableUsageMetrics;
}

const isWithinDays = (occurredAt: Date, now: Date, days: number): boolean => {
  const windowStart = now.getTime() - days * 24 * 60 * 60 * 1000;
  return occurredAt.getTime() >= windowStart;
};

const uniqueNonNull = (values: readonly (string | null)[]): number => {
  return new Set(values.filter((value): value is string => value !== null)).size;
};

export const computeMetrics = (
  input: ObservableMetricsInput,
): ObservableMetrics => {
  const observations = [...input.observations].sort(
    (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
  );
  const last7d = observations.filter((event) =>
    isWithinDays(event.occurredAt, input.now, 7),
  );
  const last30d = observations.filter((event) =>
    isWithinDays(event.occurredAt, input.now, 30),
  );
  const observableAttempts = observations.filter(
    (event) => event.outcome !== "unknown",
  );
  const successCount = observableAttempts.filter(
    (event) => event.outcome === "success",
  ).length;
  const failureCount = observableAttempts.filter(
    (event) => event.outcome === "failure",
  ).length;
  const attemptsWithGroupKey = observations.filter(
    (event) => event.groupKey !== null,
  );
  const groupedAttempts = attemptsWithGroupKey.reduce(
    (groups, event) => groups.set(event.groupKey as string, (groups.get(event.groupKey as string) ?? 0) + 1),
    new Map<string, number>(),
  );
  const groupedAttemptCount = groupedAttempts.size;
  const groupsWithRetries = Array.from(groupedAttempts.values()).filter(
    (count) => count > 1,
  ).length;

  return {
    agentId: input.agentId,
    asOf: input.now,
    derivedProxies: {
      retryIntensity: {
        attemptsWithGroupKey: attemptsWithGroupKey.length,
        averageAttemptsPerGroup:
          groupedAttemptCount > 0
            ? attemptsWithGroupKey.length / groupedAttemptCount
            : null,
        groupedAttemptCount,
        groupsWithRetries,
      },
    },
    recency: {
      eventCount7d: last7d.length,
      eventCount30d: last30d.length,
      uniquePayerCount7d: uniqueNonNull(last7d.map((event) => event.payerId)),
      uniquePayerCount30d: uniqueNonNull(last30d.map((event) => event.payerId)),
    },
    serviceId: input.serviceId,
    success: {
      failureCount,
      observableAttemptCount: observableAttempts.length,
      successCount,
      successRate:
        observableAttempts.length > 0
          ? successCount / observableAttempts.length
          : null,
    },
    usage: {
      eventCount: observations.length,
      uniquePayerCount: uniqueNonNull(observations.map((event) => event.payerId)),
    },
  };
};
