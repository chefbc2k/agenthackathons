import {
  createApiApp,
  createEmptyApiDataSource,
  startApiServer,
  type ApiApp,
  type StartedApiServer,
} from "./app.js";
import {
  createUpstashListCache,
  NoopListCache,
  type ListCache,
} from "./cache.js";
import { createStructuredLogger, type StructuredLogger } from "../observability/index.js";

export const readEnvironment = (): Record<string, string | undefined> => {
  const runtime = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return runtime.process?.env ?? {};
};

export const readPort = (
  environment: Readonly<Record<string, string | undefined>>,
): number => {
  const value = environment.PORT;
  const parsed = value ? Number.parseInt(value, 10) : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8080;
};

export const readDebugMode = (
  environment: Readonly<Record<string, string | undefined>>,
): boolean => {
  return environment.DEBUG_MODE === "true";
};

export const createCacheFromEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
): ListCache => {
  const restUrl = environment.UPSTASH_REDIS_REST_URL;
  const restToken = environment.UPSTASH_REDIS_REST_TOKEN;

  if (!restUrl || !restToken) {
    return new NoopListCache();
  }

  return createUpstashListCache({
    restToken,
    restUrl,
  });
};

export const createCliApiApp = (
  environment: Readonly<Record<string, string | undefined>>,
): ApiApp => {
  return createApiApp({
    cache: createCacheFromEnvironment(environment),
    dataSource: createEmptyApiDataSource(),
    debugModeEnabled: readDebugMode(environment),
    logger: createLoggerFromEnvironment(environment),
  });
};

export const createLoggerFromEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
): StructuredLogger => {
  return createStructuredLogger({
    debugEnabled: readDebugMode(environment),
  });
};

export const runApiServerFromEnvironment = async (): Promise<StartedApiServer> => {
  const environment = readEnvironment();

  return startApiServer({
    app: createCliApiApp(environment),
    port: readPort(environment),
  });
};
