import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { z } from "zod";

import type {
  AgentSummaryResponse,
  AgentsListResponse,
  DebugAgentResponse,
  DebugServiceResponse,
  HealthResponse,
  ObservableMetricsResponse,
  PaginationQuery,
  ReputationResponse,
  ServiceDetailResponse,
  ServiceSummaryResponse,
} from "./contracts.js";
import {
  agentDetailSchema,
  agentSummarySchema,
  agentsListResponseSchema,
  apiErrorResponseSchema,
  debugAgentResponseSchema,
  debugServiceResponseSchema,
  healthResponseSchema,
  observableMetricsResponseSchema,
  paginationQuerySchema,
  reputationResponseSchema,
  serviceDetailSchema,
  serviceSummarySchema,
  servicesListResponseSchema,
} from "./contracts.js";
import { NoopListCache, type ListCache, createListCacheKey } from "./cache.js";
import type { ObservableMetrics } from "../metrics/observable.js";
import type { StructuredLogger } from "../observability/index.js";
import type { ReputationScoreResult } from "../scoring/reputation.js";

export interface PaginatedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
}

export interface AgentRecordView {
  readonly agentCardUrl: string;
  readonly displayName: string;
  readonly id: string;
  readonly providerOrganization: string | null;
  readonly providerUrl: string | null;
}

export interface ServiceRecordView {
  readonly amount: string | null;
  readonly asset: string | null;
  readonly description: string | null;
  readonly id: string;
  readonly inputSchemaUrl: string | null;
  readonly mimeType: string | null;
  readonly network: string;
  readonly outputSchemaUrl: string | null;
  readonly payToWalletId: string;
  readonly resourceUrl: string;
  readonly schemaId: string | null;
  readonly scheme: string;
}

export interface DebugAgentRecordView extends AgentRecordView {
  readonly debug: {
    readonly agentCard: {
      readonly normalizedJson: unknown;
      readonly rawJson: unknown;
      readonly rawJsonHash: string;
      readonly signatureVerificationStatus: string;
    } | null;
  };
}

export interface DebugServiceRecordView extends ServiceRecordView {
  readonly debug: {
    readonly rawSourceJson: unknown;
    readonly sourceFingerprint: string;
  };
}

export interface ApiDataSource {
  getAgentById(id: string): Promise<AgentRecordView | null>;
  getDebugAgentById?(id: string): Promise<DebugAgentRecordView | null>;
  getDebugServiceById?(id: string): Promise<DebugServiceRecordView | null>;
  getMetricsByAgentId(id: string): Promise<ObservableMetrics | null>;
  getReputationByAgentId(id: string): Promise<ReputationScoreResult | null>;
  getServiceById(id: string): Promise<ServiceRecordView | null>;
  listAgents(pagination: PaginationQuery): Promise<PaginatedResult<AgentRecordView>>;
  listServices(
    pagination: PaginationQuery,
  ): Promise<PaginatedResult<ServiceRecordView>>;
}

export interface ApiAppDependencies {
  readonly cache?: ListCache;
  readonly cacheTtlSeconds?: number;
  readonly dataSource: ApiDataSource;
  readonly debugModeEnabled?: boolean;
  readonly logger?: StructuredLogger;
}

export interface ApiRequest {
  readonly method: string;
  readonly url: string;
}

export interface ApiResponse {
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
  readonly status: number;
}

export interface ApiApp {
  handle(request: ApiRequest): Promise<ApiResponse>;
}

export interface StartApiServerOptions {
  readonly app: ApiApp;
  readonly hostname?: string;
  readonly port?: number;
  readonly serverFactory?: ApiServerFactory;
}

export interface ApiServer {
  close(callback?: (error?: Error) => void): void;
  listen(
    port: number,
    hostname: string,
    callback?: () => void,
  ): void;
}

export type ApiServerFactory = (
  listener: (request: IncomingMessage, response: ServerResponse) => void,
) => ApiServer;

export interface StartedApiServer {
  readonly close: () => Promise<void>;
  readonly port: number;
}

export const createDefaultApiServer = (
  listener: (request: IncomingMessage, response: ServerResponse) => void,
): ApiServer => {
  return createServer(listener) as unknown as ApiServer;
};

export const resolveApiServerFactory = (
  serverFactory?: ApiServerFactory,
): ApiServerFactory => {
  return serverFactory ?? createDefaultApiServer;
};

class ApiHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiHttpError";
  }
}

const defaultHeaders = {
  "content-type": "application/json; charset=utf-8",
} as const;

const validateResponse = <TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> => {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new ApiHttpError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Response validation failed",
    );
  }

  return parsed.data;
};

const createJsonResponse = <TSchema extends z.ZodType>(
  schema: TSchema,
  status: number,
  body: unknown,
): ApiResponse => {
  return {
    body: validateResponse(schema, body),
    headers: defaultHeaders,
    status,
  };
};

const createErrorResponse = (
  status: number,
  code: string,
  message: string,
): ApiResponse => {
  return createJsonResponse(apiErrorResponseSchema, status, {
    error: {
      code,
      message,
    },
  });
};

const toPagination = (searchParams: URLSearchParams): PaginationQuery => {
  const parsed = paginationQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    throw new ApiHttpError(400, "INVALID_PAGINATION", "Invalid pagination parameters");
  }

  return parsed.data;
};

const buildPageInfo = (
  pagination: PaginationQuery,
  total: number,
): AgentsListResponse["page"] => {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.pageSize);

  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages,
  };
};

const mapAgent = (agent: AgentRecordView): AgentSummaryResponse => {
  return validateResponse(agentSummarySchema, agent);
};

const mapServiceSummary = (
  service: ServiceRecordView,
): ServiceSummaryResponse => {
  return validateResponse(serviceSummarySchema, {
    id: service.id,
    network: service.network,
    payToWalletId: service.payToWalletId,
    resourceUrl: service.resourceUrl,
    scheme: service.scheme,
  });
};

const mapServiceDetail = (service: ServiceRecordView): ServiceDetailResponse => {
  return validateResponse(serviceDetailSchema, service);
};

const mapDebugAgent = (agent: DebugAgentRecordView): DebugAgentResponse => {
  return validateResponse(debugAgentResponseSchema, agent);
};

const mapDebugService = (
  service: DebugServiceRecordView,
): DebugServiceResponse => {
  return validateResponse(debugServiceResponseSchema, service);
};

const mapMetrics = (metrics: ObservableMetrics): ObservableMetricsResponse => {
  return validateResponse(observableMetricsResponseSchema, {
    ...metrics,
    asOf: metrics.asOf.toISOString(),
  });
};

const mapReputation = (
  reputation: ReputationScoreResult,
): ReputationResponse => {
  return validateResponse(reputationResponseSchema, reputation);
};

export const createEmptyApiDataSource = (): ApiDataSource => {
  return {
    getAgentById(_id) {
      return Promise.resolve(null);
    },
    getDebugAgentById(_id) {
      return Promise.resolve(null);
    },
    getDebugServiceById(_id) {
      return Promise.resolve(null);
    },
    getMetricsByAgentId(_id) {
      return Promise.resolve(null);
    },
    getReputationByAgentId(_id) {
      return Promise.resolve(null);
    },
    getServiceById(_id) {
      return Promise.resolve(null);
    },
    listAgents(_pagination) {
      return Promise.resolve({
        items: [],
        total: 0,
      });
    },
    listServices(_pagination) {
      return Promise.resolve({
        items: [],
        total: 0,
      });
    },
  };
};

const matchResourceId = (
  pathname: string,
  resource: "agents" | "services",
): string | null => {
  const parts = pathname.split("/").filter((part) => part.length > 0);

  if (parts.length === 2 && parts[0] === resource) {
    return parts[1] as string;
  }

  return null;
};

const matchAgentNested = (
  pathname: string,
  suffix: "metrics" | "reputation",
): string | null => {
  const parts = pathname.split("/").filter((part) => part.length > 0);

  if (parts.length === 3 && parts[0] === "agents" && parts[2] === suffix) {
    return parts[1] as string;
  }

  return null;
};

const matchDebugResourceId = (
  pathname: string,
  resource: "agents" | "services",
): string | null => {
  const parts = pathname.split("/").filter((part) => part.length > 0);

  if (
    parts.length === 4 &&
    parts[0] === "internal" &&
    parts[1] === "debug" &&
    parts[2] === resource
  ) {
    return parts[3] as string;
  }

  return null;
};

const handleListWithCache = async <TResponse>(
  cache: ListCache,
  cacheKey: string,
  cacheTtlSeconds: number,
  schema: z.ZodType<TResponse>,
  load: () => Promise<TResponse>,
): Promise<ApiResponse> => {
  const cached = await cache.get<TResponse>(cacheKey);

  if (cached) {
    return createJsonResponse(schema, 200, cached);
  }

  const fresh = await load();
  await cache.set(cacheKey, fresh, cacheTtlSeconds);

  return createJsonResponse(schema, 200, fresh);
};

export const toLogPath = (url: string): string => {
  const stripQuery = (value: string): string => {
    return value.split("?")[0] as string;
  };

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      return new URL(url).pathname;
    } catch {
      return stripQuery(url);
    }
  }

  return stripQuery(url);
};

export const getErrorName = (error: unknown): string => {
  return error instanceof Error ? error.name : "UnknownError";
};

const logCompletedRequest = (
  logger: StructuredLogger | undefined,
  level: "debug" | "info",
  request: ApiRequest,
  path: string,
  startedAt: number,
  status: number,
): void => {
  logger?.[level]("api_request_completed", {
    durationMs: Date.now() - startedAt,
    method: request.method,
    path,
    status,
  });
};

export const createApiApp = (dependencies: ApiAppDependencies): ApiApp => {
  const cache = dependencies.cache ?? new NoopListCache();
  const cacheTtlSeconds = dependencies.cacheTtlSeconds ?? 30;
  const debugModeEnabled = dependencies.debugModeEnabled ?? false;
  const logger = dependencies.logger;

  return {
    async handle(request) {
      const startedAt = Date.now();

      try {
        if (request.method !== "GET") {
          throw new ApiHttpError(405, "METHOD_NOT_ALLOWED", "Only GET is supported");
        }

        const url = new URL(request.url, "http://localhost");

        if (url.pathname === "/health") {
          const response = createJsonResponse(healthResponseSchema, 200, {
            status: "ok",
          } satisfies HealthResponse);
          logCompletedRequest(logger, "info", request, url.pathname, startedAt, response.status);
          return response;
        }

        if (url.pathname === "/agents") {
          const pagination = toPagination(url.searchParams);
          const cacheKey = createListCacheKey(
            "agents",
            pagination.page,
            pagination.pageSize,
          );
          const response = await handleListWithCache(
            cache,
            cacheKey,
            cacheTtlSeconds,
            agentsListResponseSchema,
            async () => {
              const result = await dependencies.dataSource.listAgents(pagination);

              return {
                items: result.items.map(mapAgent),
                page: buildPageInfo(pagination, result.total),
              };
            },
          );
          logCompletedRequest(logger, "info", request, url.pathname, startedAt, response.status);
          return response;
        }

        const agentMetricsId = matchAgentNested(url.pathname, "metrics");

        if (agentMetricsId) {
          const metrics = await dependencies.dataSource.getMetricsByAgentId(
            agentMetricsId,
          );

          if (!metrics) {
            throw new ApiHttpError(404, "NOT_FOUND", "Agent metrics not found");
          }

          const response = createJsonResponse(
            observableMetricsResponseSchema,
            200,
            mapMetrics(metrics),
          );
          logCompletedRequest(logger, "info", request, url.pathname, startedAt, response.status);
          return response;
        }

        const agentReputationId = matchAgentNested(url.pathname, "reputation");

        if (agentReputationId) {
          const reputation = await dependencies.dataSource.getReputationByAgentId(
            agentReputationId,
          );

          if (!reputation) {
            throw new ApiHttpError(404, "NOT_FOUND", "Agent reputation not found");
          }

          const response = createJsonResponse(
            reputationResponseSchema,
            200,
            mapReputation(reputation),
          );
          logCompletedRequest(logger, "info", request, url.pathname, startedAt, response.status);
          return response;
        }

        const agentId = matchResourceId(url.pathname, "agents");

        if (agentId) {
          const agent = await dependencies.dataSource.getAgentById(agentId);

          if (!agent) {
            throw new ApiHttpError(404, "NOT_FOUND", "Agent not found");
          }

          const response = createJsonResponse(
            agentDetailSchema,
            200,
            validateResponse(agentDetailSchema, agent),
          );
          logCompletedRequest(logger, "info", request, url.pathname, startedAt, response.status);
          return response;
        }

        if (url.pathname === "/services") {
          const pagination = toPagination(url.searchParams);
          const cacheKey = createListCacheKey(
            "services",
            pagination.page,
            pagination.pageSize,
          );
          const response = await handleListWithCache(
            cache,
            cacheKey,
            cacheTtlSeconds,
            servicesListResponseSchema,
            async () => {
              const result = await dependencies.dataSource.listServices(pagination);

              return {
                items: result.items.map(mapServiceSummary),
                page: buildPageInfo(pagination, result.total),
              };
            },
          );
          logCompletedRequest(logger, "info", request, url.pathname, startedAt, response.status);
          return response;
        }

        const serviceId = matchResourceId(url.pathname, "services");

        if (serviceId) {
          const service = await dependencies.dataSource.getServiceById(serviceId);

          if (!service) {
            throw new ApiHttpError(404, "NOT_FOUND", "Service not found");
          }

          const response = createJsonResponse(
            serviceDetailSchema,
            200,
            mapServiceDetail(service),
          );
          logCompletedRequest(logger, "info", request, url.pathname, startedAt, response.status);
          return response;
        }

        const debugAgentId = matchDebugResourceId(url.pathname, "agents");

        if (debugAgentId) {
          if (!debugModeEnabled) {
            throw new ApiHttpError(404, "NOT_FOUND", "Endpoint not found");
          }

          const debugAgent = await dependencies.dataSource.getDebugAgentById?.(
            debugAgentId,
          );

          if (!debugAgent) {
            throw new ApiHttpError(404, "NOT_FOUND", "Debug agent not found");
          }

          const response = createJsonResponse(
            debugAgentResponseSchema,
            200,
            mapDebugAgent(debugAgent),
          );
          logCompletedRequest(logger, "debug", request, url.pathname, startedAt, response.status);
          return response;
        }

        const debugServiceId = matchDebugResourceId(url.pathname, "services");

        if (debugServiceId) {
          if (!debugModeEnabled) {
            throw new ApiHttpError(404, "NOT_FOUND", "Endpoint not found");
          }

          const debugService = await dependencies.dataSource.getDebugServiceById?.(
            debugServiceId,
          );

          if (!debugService) {
            throw new ApiHttpError(404, "NOT_FOUND", "Debug service not found");
          }

          const response = createJsonResponse(
            debugServiceResponseSchema,
            200,
            mapDebugService(debugService),
          );
          logCompletedRequest(logger, "debug", request, url.pathname, startedAt, response.status);
          return response;
        }

        throw new ApiHttpError(404, "NOT_FOUND", "Endpoint not found");
      } catch (error) {
        if (error instanceof ApiHttpError) {
          logger?.warn("api_request_failed", {
            code: error.code,
            durationMs: Date.now() - startedAt,
            message: error.message,
            method: request.method,
            path: toLogPath(request.url),
            status: error.status,
          });
          return createErrorResponse(error.status, error.code, error.message);
        }

        logger?.error("api_request_failed", {
          durationMs: Date.now() - startedAt,
          errorName: getErrorName(error),
          method: request.method,
          path: toLogPath(request.url),
          status: 500,
        });

        return createErrorResponse(
          500,
          "INTERNAL_SERVER_ERROR",
          "Internal server error",
        );
      }
    },
  };
};

export const createNodeRequestListener = (
  app: ApiApp,
): ((
  request: IncomingMessage,
  response: ServerResponse,
) => void) => {
  return (request, response) => {
    void app
      .handle({
        method: request.method ?? "GET",
        url: request.url ?? "/",
      })
      .then((result) => {
        response.statusCode = result.status;

        for (const [header, value] of Object.entries(result.headers)) {
          response.setHeader(header, value);
        }

        response.end(JSON.stringify(result.body));
      });
  };
};

export const startApiServer = async (
  options: StartApiServerOptions,
): Promise<StartedApiServer> => {
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? 8080;
  const serverFactory = resolveApiServerFactory(options.serverFactory);
  const server = serverFactory(createNodeRequestListener(options.app));

  await new Promise<void>((resolve) => {
    server.listen(port, hostname, () => {
      resolve();
    });
  });

  return {
    async close() {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
    port,
  };
};
