import { describe, expect, it, vi } from "vitest";

import { NoopListCache, type ListCache } from "../../src/api/cache.js";
import {
  createApiApp,
  createDefaultApiServer,
  createEmptyApiDataSource,
  getErrorName,
  createNodeRequestListener,
  resolveApiServerFactory,
  startApiServer,
  toLogPath,
  type ApiDataSource,
  type ApiServer,
} from "../../src/api/app.js";
import type { PaginationQuery } from "../../src/api/contracts.js";
import { createStructuredLogger } from "../../src/observability/index.js";

const baseDataSource: ApiDataSource = {
  getAgentById(id) {
    return Promise.resolve(
      id === "agent-1"
      ? {
          agentCardUrl: "https://example.com/.well-known/agent-card.json",
          displayName: "Agent One",
          id: "agent-1",
          providerOrganization: "Example Org",
          providerUrl: "https://example.com",
        }
      : null,
    );
  },
  getMetricsByAgentId(id) {
    return Promise.resolve(
      id === "agent-1"
      ? {
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
        }
      : null,
    );
  },
  getDebugAgentById(id) {
    return Promise.resolve(
      id === "agent-1"
        ? {
            agentCardUrl: "https://example.com/.well-known/agent-card.json",
            debug: {
              agentCard: {
                normalizedJson: {
                  name: "Agent One",
                },
                rawJson: {
                  name: "Agent One",
                  secret: "private",
                },
                rawJsonHash: "hash-agent-1",
                signatureVerificationStatus: "verified",
              },
            },
            displayName: "Agent One",
            id: "agent-1",
            providerOrganization: "Example Org",
            providerUrl: "https://example.com",
          }
        : null,
    );
  },
  getDebugServiceById(id) {
    return Promise.resolve(
      id === "service-1"
        ? {
            amount: "1000",
            asset: "USDC",
            debug: {
              rawSourceJson: {
                payTo: "0xservicewallet",
                resource: "https://example.com/service",
              },
              sourceFingerprint: "fingerprint-service-1",
            },
            description: null,
            id: "service-1",
            inputSchemaUrl: null,
            mimeType: null,
            network: "eip155:8453",
            outputSchemaUrl: null,
            payToWalletId: "wallet-1",
            resourceUrl: "https://example.com/service",
            schemaId: null,
            scheme: "exact",
          }
        : null,
    );
  },
  getReputationByAgentId(id) {
    return Promise.resolve(
      id === "agent-1"
      ? {
          agentId: "agent-1",
          confidenceTier: "medium",
          explanation: {
            diversityFactor: 0.5,
            inferenceLabel: "inference",
            observableAttemptCount: 2,
            payerDiversityRatio: 0.5,
            rawSuccessRate: 0.5,
            recencyFactor: 0.75,
            retryPenalty: 0.25,
            weightedSuccessRate: 0.5,
          },
          inferenceLabel: "inference",
          score: 52.5,
          serviceId: "service-1",
        }
      : null,
    );
  },
  getServiceById(id) {
    return Promise.resolve(
      id === "service-1"
      ? {
          amount: "1000",
          asset: "USDC",
          description: null,
          id: "service-1",
          inputSchemaUrl: null,
          mimeType: null,
          network: "eip155:8453",
          outputSchemaUrl: null,
          payToWalletId: "wallet-1",
          resourceUrl: "https://example.com/service",
          schemaId: null,
          scheme: "exact",
        }
      : null,
    );
  },
  listAgents(pagination) {
    const items = [
      {
        agentCardUrl: "https://example.com/.well-known/agent-card.json",
        displayName: "Agent One",
        id: "agent-1",
        providerOrganization: "Example Org",
        providerUrl: "https://example.com",
      },
      {
        agentCardUrl: "https://another.example/.well-known/agent-card.json",
        displayName: "Agent Two",
        id: "agent-2",
        providerOrganization: null,
        providerUrl: null,
      },
    ];
    const start = (pagination.page - 1) * pagination.pageSize;

    return Promise.resolve({
      items: items.slice(start, start + pagination.pageSize),
      total: items.length,
    });
  },
  listServices(pagination) {
    const items = [
      {
        amount: null,
        asset: null,
        description: null,
        id: "service-1",
        inputSchemaUrl: null,
        mimeType: null,
        network: "eip155:8453",
        outputSchemaUrl: null,
        payToWalletId: "wallet-1",
        resourceUrl: "https://example.com/service",
        schemaId: null,
        scheme: "exact",
      },
    ];
    const start = (pagination.page - 1) * pagination.pageSize;

    return Promise.resolve({
      items: items.slice(start, start + pagination.pageSize),
      total: items.length,
    });
  },
};

const createCache = ({
  cachedValue,
}: {
  readonly cachedValue: unknown;
}): {
  readonly cache: ListCache;
  readonly get: ReturnType<typeof vi.fn>;
  readonly set: ReturnType<typeof vi.fn>;
} => {
  const get = vi.fn().mockResolvedValue(cachedValue);
  const set = vi.fn().mockResolvedValue(undefined);

  return {
    cache: {
      get,
      set,
    },
    get,
    set,
  };
};

describe("createEmptyApiDataSource", () => {
  it("returns deterministic empty reads", async () => {
    const dataSource = createEmptyApiDataSource();

    await expect(dataSource.getAgentById("missing")).resolves.toBeNull();
    await expect(dataSource.getDebugAgentById?.("missing")).resolves.toBeNull();
    await expect(dataSource.getDebugServiceById?.("missing")).resolves.toBeNull();
    await expect(dataSource.getMetricsByAgentId("missing")).resolves.toBeNull();
    await expect(dataSource.getReputationByAgentId("missing")).resolves.toBeNull();
    await expect(dataSource.getServiceById("missing")).resolves.toBeNull();
    await expect(dataSource.listAgents({ page: 1, pageSize: 10 })).resolves.toEqual({
      items: [],
      total: 0,
    });
    await expect(
      dataSource.listServices({ page: 1, pageSize: 10 }),
    ).resolves.toEqual({
      items: [],
      total: 0,
    });
  });
});

describe("createApiApp", () => {
  it("serves health", async () => {
    const app = createApiApp({
      dataSource: baseDataSource,
    });

    await expect(app.handle({ method: "GET", url: "/health" })).resolves.toEqual({
      body: { status: "ok" },
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      status: 200,
    });
  });

  it("applies pagination to list endpoints", async () => {
    const app = createApiApp({
      dataSource: baseDataSource,
    });

    await expect(
      app.handle({ method: "GET", url: "/agents?page=2&pageSize=1" }),
    ).resolves.toEqual({
      body: {
        items: [
          {
            agentCardUrl: "https://another.example/.well-known/agent-card.json",
            displayName: "Agent Two",
            id: "agent-2",
            providerOrganization: null,
            providerUrl: null,
          },
        ],
        page: {
          page: 2,
          pageSize: 1,
          total: 2,
          totalPages: 2,
        },
      },
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      status: 200,
    });
  });

  it("uses cache hits for list endpoints", async () => {
    const { cache, get, set } = createCache({
      cachedValue: {
        items: [],
        page: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        },
      },
    });
    const dataSource = {
      ...baseDataSource,
      listAgents: vi.fn((pagination: PaginationQuery) =>
        baseDataSource.listAgents(pagination),
      ),
    };
    const app = createApiApp({
      cache,
      dataSource,
    });

    await expect(app.handle({ method: "GET", url: "/agents" })).resolves.toMatchObject({
      status: 200,
      body: {
        items: [],
      },
    });
    expect(get).toHaveBeenCalledOnce();
    expect(set).not.toHaveBeenCalled();
    expect(dataSource.listAgents).not.toHaveBeenCalled();
  });

  it("uses cache misses for list endpoints and stores the response", async () => {
    const { cache, get, set } = createCache({
      cachedValue: null,
    });
    const dataSource = {
      ...baseDataSource,
      listServices: vi.fn((pagination: PaginationQuery) =>
        baseDataSource.listServices(pagination),
      ),
    };
    const app = createApiApp({
      cache,
      cacheTtlSeconds: 45,
      dataSource,
    });

    await expect(app.handle({ method: "GET", url: "/services" })).resolves.toMatchObject({
      status: 200,
      body: {
        items: [
          {
            id: "service-1",
          },
        ],
      },
    });
    expect(get).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledOnce();
    expect(dataSource.listServices).toHaveBeenCalledOnce();
  });

  it("returns zero total pages for uncached empty list responses", async () => {
    const app = createApiApp({
      cache: new NoopListCache(),
      dataSource: createEmptyApiDataSource(),
    });

    await expect(app.handle({ method: "GET", url: "/agents" })).resolves.toEqual({
      body: {
        items: [],
        page: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        },
      },
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      status: 200,
    });
  });

  it("serves detail, metrics, and reputation endpoints", async () => {
    const app = createApiApp({
      dataSource: baseDataSource,
    });

    await expect(app.handle({ method: "GET", url: "/agents/agent-1" })).resolves.toMatchObject({
      status: 200,
      body: {
        id: "agent-1",
      },
    });
    await expect(
      app.handle({ method: "GET", url: "/agents/agent-1/metrics" }),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        agentId: "agent-1",
        asOf: "2026-03-13T12:00:00.000Z",
      },
    });
    await expect(
      app.handle({ method: "GET", url: "/agents/agent-1/reputation" }),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        agentId: "agent-1",
        inferenceLabel: "inference",
      },
    });
    await expect(
      app.handle({ method: "GET", url: "/services/service-1" }),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        id: "service-1",
      },
    });
  });

  it("does not leak payer identities or raw payloads through public endpoints", async () => {
    const app = createApiApp({
      dataSource: baseDataSource,
    });

    const metricsResponse = await app.handle({
      method: "GET",
      url: "/agents/agent-1/metrics",
    });
    const serviceResponse = await app.handle({
      method: "GET",
      url: "/services/service-1",
    });

    expect(JSON.stringify(metricsResponse.body)).not.toContain("0xpayer");
    expect(JSON.stringify(serviceResponse.body)).not.toContain("rawSourceJson");
  });

  it("serves internal debug endpoints only when debug mode is enabled", async () => {
    const app = createApiApp({
      dataSource: baseDataSource,
      debugModeEnabled: true,
    });

    await expect(
      app.handle({ method: "GET", url: "/internal/debug/agents/agent-1" }),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        debug: {
          agentCard: {
            rawJsonHash: "hash-agent-1",
          },
        },
        id: "agent-1",
      },
    });
    await expect(
      app.handle({ method: "GET", url: "/internal/debug/services/service-1" }),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        debug: {
          sourceFingerprint: "fingerprint-service-1",
        },
        id: "service-1",
      },
    });
  });

  it("hides internal debug endpoints when debug mode is disabled", async () => {
    const app = createApiApp({
      dataSource: baseDataSource,
      debugModeEnabled: false,
    });

    await expect(
      app.handle({ method: "GET", url: "/internal/debug/agents/agent-1" }),
    ).resolves.toMatchObject({
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: "Endpoint not found",
        },
      },
    });
    await expect(
      app.handle({ method: "GET", url: "/internal/debug/services/service-1" }),
    ).resolves.toMatchObject({
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: "Endpoint not found",
        },
      },
    });
  });

  it("maps missing internal debug resources to 404 when debug mode is enabled", async () => {
    const app = createApiApp({
      dataSource: baseDataSource,
      debugModeEnabled: true,
    });

    await expect(
      app.handle({ method: "GET", url: "/internal/debug/agents/missing" }),
    ).resolves.toMatchObject({
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: "Debug agent not found",
        },
      },
    });
    await expect(
      app.handle({ method: "GET", url: "/internal/debug/services/missing" }),
    ).resolves.toMatchObject({
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: "Debug service not found",
        },
      },
    });
  });

  it("emits redacted structured logs for failures", async () => {
    const lines: string[] = [];
    const logger = createStructuredLogger({
      debugEnabled: true,
      sink(line) {
        lines.push(line);
      },
    });
    const app = createApiApp({
      dataSource: baseDataSource,
      logger,
    });

    await app.handle({
      method: "POST",
      url: "https://example.com/health?payer=0xpayer123456",
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("api_request_failed");
    expect(lines[0]).not.toContain("0xpayer123456");
    expect(lines[0]).toContain("\"path\":\"/health\"");
  });

  it("logs internal errors with sanitized fallback paths", async () => {
    const lines: string[] = [];
    const logger = createStructuredLogger({
      debugEnabled: true,
      sink(line) {
        lines.push(line);
      },
    });
    const app = createApiApp({
      dataSource: baseDataSource,
      logger,
    });

    await expect(
      app.handle({ method: "GET", url: "http://[::1" }),
    ).resolves.toMatchObject({
      status: 500,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("\"level\":\"error\"");
    expect(lines[0]).toContain("\"path\":\"http://[::1\"");
  });

  it("normalizes log helper inputs deterministically", () => {
    expect(toLogPath("/health?payer=secret")).toBe("/health");
    expect(toLogPath("https://example.com/health?payer=secret")).toBe("/health");
    expect(toLogPath("https://example.com:bad/health?payer=secret")).toBe(
      "https://example.com:bad/health",
    );
    expect(getErrorName(new Error("boom"))).toBe("Error");
    expect(getErrorName("boom")).toBe("UnknownError");
  });

  it("maps not-found, bad pagination, method, and internal validation errors", async () => {
    const app = createApiApp({
      dataSource: {
        ...baseDataSource,
        getAgentById() {
          return Promise.resolve(null);
        },
        listAgents() {
          return Promise.resolve({
            items: [
              {
                agentCardUrl: "not-a-url",
                displayName: "Broken",
                id: "agent-bad",
                providerOrganization: null,
                providerUrl: null,
              },
            ],
            total: 1,
          });
        },
      },
    });

    await expect(
      app.handle({ method: "GET", url: "/agents/missing" }),
    ).resolves.toEqual({
      body: {
        error: {
          code: "NOT_FOUND",
          message: "Agent not found",
        },
      },
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      status: 404,
    });
    await expect(
      app.handle({ method: "GET", url: "/agents?page=0" }),
    ).resolves.toMatchObject({
      status: 400,
      body: {
        error: {
          code: "INVALID_PAGINATION",
        },
      },
    });
    await expect(
      app.handle({ method: "POST", url: "/health" }),
    ).resolves.toMatchObject({
      status: 405,
      body: {
        error: {
          code: "METHOD_NOT_ALLOWED",
        },
      },
    });
    await expect(
      app.handle({ method: "GET", url: "/agents" }),
    ).resolves.toMatchObject({
      status: 500,
      body: {
        error: {
          code: "INTERNAL_SERVER_ERROR",
        },
      },
    });
  });

  it("maps missing nested agent resources and services to 404", async () => {
    const app = createApiApp({
      dataSource: createEmptyApiDataSource(),
    });

    await expect(
      app.handle({ method: "GET", url: "/agents/missing/metrics" }),
    ).resolves.toMatchObject({
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: "Agent metrics not found",
        },
      },
    });
    await expect(
      app.handle({ method: "GET", url: "/agents/missing/reputation" }),
    ).resolves.toMatchObject({
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: "Agent reputation not found",
        },
      },
    });
    await expect(
      app.handle({ method: "GET", url: "/services/missing" }),
    ).resolves.toMatchObject({
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: "Service not found",
        },
      },
    });
  });

  it("maps unknown paths to 404", async () => {
    const app = createApiApp({
      dataSource: baseDataSource,
    });

    await expect(app.handle({ method: "GET", url: "/unknown" })).resolves.toMatchObject({
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
        },
      },
    });
  });
});

describe("node api server helpers", () => {
  it("writes JSON responses through the node request listener", async () => {
    const listener = createNodeRequestListener(
      createApiApp({
        dataSource: baseDataSource,
      }),
    );
    const setHeader = vi.fn();
    const end = vi.fn();

    listener(
      {
        method: "GET",
        url: "/health",
      } as never,
      {
        end,
        setHeader,
      } as unknown as never,
    );
    await Promise.resolve();

    expect(setHeader).toHaveBeenCalledWith(
      "content-type",
      "application/json; charset=utf-8",
    );
    expect(end).toHaveBeenCalledWith(JSON.stringify({ status: "ok" }));
  });

  it("defaults missing node request fields before dispatching", async () => {
    const listener = createNodeRequestListener(
      createApiApp({
        dataSource: baseDataSource,
      }),
    );
    const setHeader = vi.fn();
    const end = vi.fn();

    listener(
      {} as never,
      {
        end,
        setHeader,
      } as unknown as never,
    );
    await Promise.resolve();

    expect(end).toHaveBeenCalledWith(
      JSON.stringify({
        error: {
          code: "NOT_FOUND",
          message: "Endpoint not found",
        },
      }),
    );
  });

  it("starts and stops the api server through the injected server factory", async () => {
    const listen = vi.fn((_port: number, _hostname: string, callback?: () => void) => {
      callback?.();
    });
    const close = vi.fn((callback?: () => void) => {
      callback?.();
    });
    const serverFactory = vi.fn(
      () =>
        ({
          close,
          listen,
        }) satisfies ApiServer,
    );

    const started = await startApiServer({
      app: createApiApp({
        dataSource: baseDataSource,
      }),
      hostname: "127.0.0.1",
      port: 9090,
      serverFactory,
    });

    expect(started.port).toBe(9090);
    await expect(started.close()).resolves.toBeUndefined();
    expect(listen).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("creates a default node server adapter", () => {
    const server = createDefaultApiServer(() => undefined);

    expect(typeof server.listen).toBe("function");
    expect(typeof server.close).toBe("function");
    server.close();
  });

  it("resolves custom and default server factories deterministically", () => {
    const customFactory = vi.fn(() => {
      return {
        close() {},
        listen() {},
      } satisfies ApiServer;
    });

    expect(resolveApiServerFactory()).toBe(createDefaultApiServer);
    expect(resolveApiServerFactory(customFactory)).toBe(customFactory);
  });

  it("uses default host and port when server options are omitted", async () => {
    const listen = vi.fn((_port: number, _hostname: string, callback?: () => void) => {
      callback?.();
    });
    const close = vi.fn((callback?: () => void) => {
      callback?.();
    });

    const started = await startApiServer({
      app: createApiApp({
        dataSource: baseDataSource,
      }),
      serverFactory: () =>
        ({
          close,
          listen,
        }) satisfies ApiServer,
    });

    expect(started.port).toBe(8080);
    expect(listen).toHaveBeenCalledWith(8080, "127.0.0.1", expect.any(Function));
    await started.close();
  });

  it("maps malformed request urls to internal server errors", async () => {
    const app = createApiApp({
      dataSource: baseDataSource,
    });

    await expect(app.handle({ method: "GET", url: "http://[" })).resolves.toMatchObject({
      status: 500,
      body: {
        error: {
          code: "INTERNAL_SERVER_ERROR",
        },
      },
    });
  });
});
