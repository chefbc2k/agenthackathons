import { z } from "zod";

export class WorkerConfigError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(issues.join("; "));
    this.name = "WorkerConfigError";
    this.issues = issues;
  }
}

const workerEnvironmentSchema = z
  .object({
    A2A_AGENT_DOMAINS: z.string().trim().nullable(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().trim().min(1).nullable(),
    QSTASH_NEXT_SIGNING_KEY: z.string().trim().min(1).nullable(),
    QSTASH_SCHEDULE_CRON: z.string().trim().min(1).nullable(),
    QSTASH_SCHEDULE_DESTINATION: z.string().trim().url().nullable(),
    QSTASH_TOKEN: z.string().trim().min(1).nullable(),
    WORKER_RECEIVER_PORT: z.coerce.number().int().min(1).max(65535).nullable(),
    WORKER_SCHEDULE_MINUTES: z.coerce.number().int().min(1).max(59).nullable(),
    X402_BAZAAR_FACILITATOR_URL: z.string().trim().url().nullable(),
  })
  .strict();

type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

export interface WorkerQstashConfig {
  readonly currentSigningKey: string | null;
  readonly destination: string | null;
  readonly enabled: boolean;
  readonly nextSigningKey: string | null;
  readonly scheduleCron: string | null;
  readonly scheduleEveryMinutes: number | null;
  readonly token: string | null;
}

export interface WorkerRuntimeConfig {
  readonly agentDomains: readonly string[];
  readonly bazaarFacilitatorBaseUrl: string | null;
  readonly qstash: WorkerQstashConfig;
  readonly receiverPort: number;
}

const readDefaultEnvironment = (): Record<string, string | undefined> => {
  const runtime = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return runtime.process?.env ?? {};
};

const normalizeEnvironmentValue = (value: string | undefined): string | null => {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const normalizeWorkerEnvironment = (
  environmentSource: Record<string, string | undefined>,
): WorkerEnvironment => {
  const parsed = workerEnvironmentSchema.safeParse({
    A2A_AGENT_DOMAINS: normalizeEnvironmentValue(
      environmentSource.A2A_AGENT_DOMAINS,
    ),
    QSTASH_CURRENT_SIGNING_KEY: normalizeEnvironmentValue(
      environmentSource.QSTASH_CURRENT_SIGNING_KEY,
    ),
    QSTASH_NEXT_SIGNING_KEY: normalizeEnvironmentValue(
      environmentSource.QSTASH_NEXT_SIGNING_KEY,
    ),
    QSTASH_SCHEDULE_CRON: normalizeEnvironmentValue(
      environmentSource.QSTASH_SCHEDULE_CRON,
    ),
    QSTASH_SCHEDULE_DESTINATION: normalizeEnvironmentValue(
      environmentSource.QSTASH_SCHEDULE_DESTINATION,
    ),
    QSTASH_TOKEN: normalizeEnvironmentValue(environmentSource.QSTASH_TOKEN),
    WORKER_RECEIVER_PORT: normalizeEnvironmentValue(
      environmentSource.WORKER_RECEIVER_PORT,
    ),
    WORKER_SCHEDULE_MINUTES: normalizeEnvironmentValue(
      environmentSource.WORKER_SCHEDULE_MINUTES,
    ),
    X402_BAZAAR_FACILITATOR_URL: normalizeEnvironmentValue(
      environmentSource.X402_BAZAAR_FACILITATOR_URL,
    ),
  });

  if (!parsed.success) {
    throw new WorkerConfigError(
      parsed.error.issues.map(
        (issue) => `${issue.path[0]!.toString()}: ${issue.message}`,
      ),
    );
  }

  return parsed.data;
};

const splitDomains = (value: string | null): readonly string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const minutesToCronExpression = (minutes: number): string => {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 59) {
    throw new WorkerConfigError([
      "WORKER_SCHEDULE_MINUTES: Expected an integer between 1 and 59",
    ]);
  }

  return `*/${minutes} * * * *`;
};

export const resolveWorkerScheduleCron = (
  environment: WorkerEnvironment,
): string | null => {
  if (environment.QSTASH_SCHEDULE_CRON) {
    return environment.QSTASH_SCHEDULE_CRON;
  }

  if (environment.WORKER_SCHEDULE_MINUTES !== null) {
    return minutesToCronExpression(environment.WORKER_SCHEDULE_MINUTES);
  }

  return null;
};

export const loadWorkerConfig = (
  environmentSource: Record<string, string | undefined> = readDefaultEnvironment(),
): WorkerRuntimeConfig => {
  const environment = normalizeWorkerEnvironment(environmentSource);
  const scheduleCron = resolveWorkerScheduleCron(environment);
  const issues: string[] = [];

  if (environment.QSTASH_SCHEDULE_DESTINATION && !scheduleCron) {
    issues.push(
      "QSTASH_SCHEDULE_DESTINATION: Provide QSTASH_SCHEDULE_CRON or WORKER_SCHEDULE_MINUTES",
    );
  }

  if (scheduleCron && !environment.QSTASH_SCHEDULE_DESTINATION) {
    issues.push(
      "QSTASH_SCHEDULE_DESTINATION: Required when schedule cron or minutes are configured",
    );
  }

  if (issues.length > 0) {
    throw new WorkerConfigError(issues);
  }

  return {
    agentDomains: splitDomains(environment.A2A_AGENT_DOMAINS),
    bazaarFacilitatorBaseUrl: environment.X402_BAZAAR_FACILITATOR_URL,
    qstash: {
      currentSigningKey: environment.QSTASH_CURRENT_SIGNING_KEY,
      destination: environment.QSTASH_SCHEDULE_DESTINATION,
      enabled: environment.QSTASH_TOKEN !== null,
      nextSigningKey: environment.QSTASH_NEXT_SIGNING_KEY,
      scheduleCron,
      scheduleEveryMinutes: environment.WORKER_SCHEDULE_MINUTES,
      token: environment.QSTASH_TOKEN,
    },
    receiverPort: environment.WORKER_RECEIVER_PORT ?? 8787,
  };
};
