import { z } from "zod";

const optionalUrlSchema = z
  .string()
  .trim()
  .url()
  .nullable()
  .transform((value) => value ?? "");

const qstashScheduleSchema = z
  .object({
    endpoint: z.string().trim().url(),
    cron: z.string().trim().min(1),
  })
  .strict();

const baseEnvironmentSchema = z
  .object({
    DATABASE_URL: z.string().trim().url(),
    DEBUG_MODE: z
      .enum(["true", "false"])
      .nullable()
      .transform((value) => value === "true"),
    KV_REST_API_TOKEN: z.string().trim().min(1).nullable(),
    KV_REST_API_URL: z.string().trim().url().nullable(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().trim().min(1).nullable(),
    QSTASH_NEXT_SIGNING_KEY: z.string().trim().min(1).nullable(),
    QSTASH_SCHEDULE_CRON: z.string().trim().min(1).nullable(),
    QSTASH_SCHEDULE_DESTINATION: z.string().trim().url().nullable(),
    QSTASH_TOKEN: z.string().trim().min(1).nullable(),
    RPC_URL_BASE: optionalUrlSchema,
    RPC_URL_ETHEREUM: optionalUrlSchema,
    RPC_URL_OPTIMISM: optionalUrlSchema,
    UPSTASH_REDIS_REST_TOKEN: z.string().trim().min(1).nullable(),
    UPSTASH_REDIS_REST_URL: z.string().trim().url().nullable(),
  })
  .strict();

export interface ConfigValidationError {
  readonly key: string;
  readonly message: string;
}

export class ConfigError extends Error {
  public readonly issues: readonly ConfigValidationError[];

  public constructor(issues: readonly ConfigValidationError[]) {
    super(
      issues
        .map((issue) => `${issue.key}: ${issue.message}`)
        .join("; "),
    );
    this.name = "ConfigError";
    this.issues = issues;
  }
}

export interface RedisConfig {
  readonly restToken: string;
  readonly restUrl: string;
}

export interface QstashScheduleConfig {
  readonly cron: string;
  readonly destination: string;
}

export interface QstashConfig {
  readonly currentSigningKey: string | null;
  readonly enabled: boolean;
  readonly nextSigningKey: string | null;
  readonly schedule: QstashScheduleConfig | null;
  readonly token: string | null;
}

export interface RpcConfig {
  readonly base: string;
  readonly ethereum: string;
  readonly optimism: string;
}

export interface AppConfig {
  readonly databaseUrl: string;
  readonly debugMode: boolean;
  readonly qstash: QstashConfig;
  readonly redis: RedisConfig;
  readonly rpc: RpcConfig;
}

type EnvironmentInput = Record<string, string | undefined>;

interface ValidationSuccess<TData> {
  readonly success: true;
  readonly data: TData;
}

interface ValidationFailure {
  readonly success: false;
  readonly issues: readonly ConfigValidationError[];
}

type ValidationResult<TData> = ValidationSuccess<TData> | ValidationFailure;

const readDefaultEnvironment = (): EnvironmentInput => {
  const runtime = globalThis as {
    process?: {
      env?: EnvironmentInput;
    };
  };

  return runtime.process?.env ?? {};
};

const normalizeEnvironmentValue = (value: string | undefined): string | null => {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const toValidationIssue = (
  key: string,
  message: string,
): ConfigValidationError => ({
  key,
  message,
});

export const parseEnvironmentObject = (
  environment: Record<string, unknown>,
): ValidationResult<z.infer<typeof baseEnvironmentSchema>> => {
  const parsed = baseEnvironmentSchema.safeParse(environment);

  if (parsed.success) {
    return {
      success: true as const,
      data: parsed.data,
    };
  }

    return {
      success: false as const,
      issues: parsed.error.issues.map((issue) =>
      toValidationIssue(
        issue.path[0]?.toString() ?? "ENV",
        issue.message,
      ),
    ),
  };
};

const resolveRedisConfig = (
  environment: z.infer<typeof baseEnvironmentSchema>,
): ValidationResult<RedisConfig> => {
  const restUrl = environment.UPSTASH_REDIS_REST_URL ?? environment.KV_REST_API_URL;
  const restToken =
    environment.UPSTASH_REDIS_REST_TOKEN ?? environment.KV_REST_API_TOKEN;

  const issues: ConfigValidationError[] = [];

  if (!restUrl) {
    issues.push(
      toValidationIssue(
        "UPSTASH_REDIS_REST_URL",
        "Required when KV_REST_API_URL is not provided",
      ),
    );
  }

  if (!restToken) {
    issues.push(
      toValidationIssue(
        "UPSTASH_REDIS_REST_TOKEN",
        "Required when KV_REST_API_TOKEN is not provided",
      ),
    );
  }

  if (issues.length > 0) {
    return {
      success: false,
      issues,
    };
  }

  return {
    success: true,
    data: {
      restToken: restToken as string,
      restUrl: restUrl as string,
    },
  };
};

const resolveQstashSchedule = (
  environment: z.infer<typeof baseEnvironmentSchema>,
): ValidationResult<QstashScheduleConfig | null> => {
  const cron = environment.QSTASH_SCHEDULE_CRON;
  const destination = environment.QSTASH_SCHEDULE_DESTINATION;

  if (!cron && !destination) {
    return {
      success: true,
      data: null,
    };
  }

  const parsed = qstashScheduleSchema.safeParse({
    cron,
    endpoint: destination,
  });

  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) =>
        toValidationIssue(
          issue.path[0] === "endpoint"
            ? "QSTASH_SCHEDULE_DESTINATION"
            : "QSTASH_SCHEDULE_CRON",
          issue.message,
        ),
      ),
    };
  }

  return {
    success: true,
    data: {
      cron: parsed.data.cron,
      destination: parsed.data.endpoint,
    },
  };
};

export const loadConfig = (
  environmentSource: EnvironmentInput = readDefaultEnvironment(),
): AppConfig => {
  const environment = {
    DATABASE_URL: normalizeEnvironmentValue(environmentSource.DATABASE_URL),
    DEBUG_MODE: normalizeEnvironmentValue(environmentSource.DEBUG_MODE),
    KV_REST_API_TOKEN: normalizeEnvironmentValue(
      environmentSource.KV_REST_API_TOKEN,
    ),
    KV_REST_API_URL: normalizeEnvironmentValue(environmentSource.KV_REST_API_URL),
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
    RPC_URL_BASE: normalizeEnvironmentValue(environmentSource.RPC_URL_BASE),
    RPC_URL_ETHEREUM: normalizeEnvironmentValue(environmentSource.RPC_URL_ETHEREUM),
    RPC_URL_OPTIMISM: normalizeEnvironmentValue(environmentSource.RPC_URL_OPTIMISM),
    UPSTASH_REDIS_REST_TOKEN: normalizeEnvironmentValue(
      environmentSource.UPSTASH_REDIS_REST_TOKEN,
    ),
    UPSTASH_REDIS_REST_URL: normalizeEnvironmentValue(
      environmentSource.UPSTASH_REDIS_REST_URL,
    ),
  };

  const baseParse = parseEnvironmentObject(environment);

  if (!baseParse.success) {
    throw new ConfigError(baseParse.issues);
  }

  const redisConfig = resolveRedisConfig(baseParse.data);
  const qstashSchedule = resolveQstashSchedule(baseParse.data);
  const issues: ConfigValidationError[] = [];

  if (!redisConfig.success) {
    issues.push(...redisConfig.issues);
  }

  if (!qstashSchedule.success) {
    issues.push(...qstashSchedule.issues);
  }

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }

  const resolvedRedis = (redisConfig as ValidationSuccess<RedisConfig>).data;
  const resolvedQstashSchedule =
    (qstashSchedule as ValidationSuccess<QstashScheduleConfig | null>).data;

  return {
    databaseUrl: baseParse.data.DATABASE_URL,
    debugMode: baseParse.data.DEBUG_MODE,
    qstash: {
      currentSigningKey: baseParse.data.QSTASH_CURRENT_SIGNING_KEY,
      enabled: baseParse.data.QSTASH_TOKEN !== null,
      nextSigningKey: baseParse.data.QSTASH_NEXT_SIGNING_KEY,
      schedule: resolvedQstashSchedule,
      token: baseParse.data.QSTASH_TOKEN,
    },
    redis: resolvedRedis,
    rpc: {
      base: baseParse.data.RPC_URL_BASE,
      ethereum: baseParse.data.RPC_URL_ETHEREUM,
      optimism: baseParse.data.RPC_URL_OPTIMISM,
    },
  };
};
