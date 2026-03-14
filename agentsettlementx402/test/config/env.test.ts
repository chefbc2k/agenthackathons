import { describe, expect, it } from "vitest";

import {
  ConfigError,
  loadConfig,
  parseEnvironmentObject,
} from "../../src/config/env.js";

describe("loadConfig", () => {
  const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, "process");

  const setProcessEnv = (environment: Record<string, string> | undefined) => {
    Object.defineProperty(globalThis, "process", {
      configurable: true,
      value: environment ? { env: environment } : undefined,
    });
  };

  const restoreProcess = () => {
    if (processDescriptor) {
      Object.defineProperty(globalThis, "process", processDescriptor);
      return;
    }

    delete (globalThis as { process?: unknown }).process;
  };

  it("loads a valid config with explicit Upstash and QStash values", () => {
    expect(
      loadConfig({
        DATABASE_URL:
          "postgresql://user:password@ep-example.us-east-1.aws.neon.tech/dbname?sslmode=require",
        QSTASH_CURRENT_SIGNING_KEY: "current-signing-key",
        QSTASH_NEXT_SIGNING_KEY: "next-signing-key",
        QSTASH_SCHEDULE_CRON: "*/5 * * * *",
        QSTASH_SCHEDULE_DESTINATION: "https://example.com/jobs",
        QSTASH_TOKEN: "qstash-token",
        RPC_URL_BASE: "https://base.example.com",
        RPC_URL_ETHEREUM: "",
        RPC_URL_OPTIMISM: "",
        UPSTASH_REDIS_REST_TOKEN: "redis-token",
        UPSTASH_REDIS_REST_URL: "https://example-123.upstash.io",
      }),
    ).toEqual({
      databaseUrl:
        "postgresql://user:password@ep-example.us-east-1.aws.neon.tech/dbname?sslmode=require",
      debugMode: false,
      qstash: {
        currentSigningKey: "current-signing-key",
        enabled: true,
        nextSigningKey: "next-signing-key",
        schedule: {
          cron: "*/5 * * * *",
          destination: "https://example.com/jobs",
        },
        token: "qstash-token",
      },
      redis: {
        restToken: "redis-token",
        restUrl: "https://example-123.upstash.io",
      },
      rpc: {
        base: "https://base.example.com",
        ethereum: "",
        optimism: "",
      },
    });
  });

  it("supports the alternate Upstash KV env names and empty optional RPC URLs", () => {
    expect(
      loadConfig({
        DATABASE_URL: "postgresql://user:password@example.neon.tech/app",
        KV_REST_API_TOKEN: "kv-token",
        KV_REST_API_URL: "https://kv-example.upstash.io",
      }),
    ).toEqual({
      databaseUrl: "postgresql://user:password@example.neon.tech/app",
      debugMode: false,
      qstash: {
        currentSigningKey: null,
        enabled: false,
        nextSigningKey: null,
        schedule: null,
        token: null,
      },
      redis: {
        restToken: "kv-token",
        restUrl: "https://kv-example.upstash.io",
      },
      rpc: {
        base: "",
        ethereum: "",
        optimism: "",
      },
    });
  });

  it("fails when required variables are missing", () => {
    expect(() => loadConfig({})).toThrowError(ConfigError);
    expect(() => loadConfig({})).toThrowError(
      "DATABASE_URL: Invalid input: expected string, received null",
    );
  });

  it("fails when redis configuration is missing from both supported env formats", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://user:password@example.neon.tech/app",
      }),
    ).toThrowError(
      "UPSTASH_REDIS_REST_URL: Required when KV_REST_API_URL is not provided; UPSTASH_REDIS_REST_TOKEN: Required when KV_REST_API_TOKEN is not provided",
    );
  });

  it("fails when a URL variable is malformed without echoing secret values", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://user:secret@example.neon.tech/app",
        UPSTASH_REDIS_REST_TOKEN: "super-secret-token",
        UPSTASH_REDIS_REST_URL: "not-a-url",
      }),
    ).toThrowError(ConfigError);

    try {
      loadConfig({
        DATABASE_URL: "postgresql://user:secret@example.neon.tech/app",
        UPSTASH_REDIS_REST_TOKEN: "super-secret-token",
        UPSTASH_REDIS_REST_URL: "not-a-url",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const message = (error as Error).message;

      expect(message).toContain("UPSTASH_REDIS_REST_URL");
      expect(message).not.toContain("super-secret-token");
      expect(message).not.toContain("postgresql://user:secret@example.neon.tech/app");
    }
  });

  it("fails when only part of the qstash schedule configuration is provided", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://user:password@example.neon.tech/app",
        UPSTASH_REDIS_REST_TOKEN: "redis-token",
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
        QSTASH_SCHEDULE_CRON: "*/5 * * * *",
      }),
    ).toThrowError(
      "QSTASH_SCHEDULE_DESTINATION: Invalid input: expected string, received null",
    );
  });

  it("fails when qstash schedule destination exists without a cron expression", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://user:password@example.neon.tech/app",
        UPSTASH_REDIS_REST_TOKEN: "redis-token",
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
        QSTASH_SCHEDULE_DESTINATION: "https://example.com/jobs",
      }),
    ).toThrowError(
      "QSTASH_SCHEDULE_CRON: Invalid input: expected string, received null",
    );
  });

  it("can read config from the default process environment", () => {
    setProcessEnv({
      DATABASE_URL: "postgresql://user:password@example.neon.tech/app",
      DEBUG_MODE: "true",
      UPSTASH_REDIS_REST_TOKEN: "redis-token",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    });

    expect(loadConfig()).toEqual({
      databaseUrl: "postgresql://user:password@example.neon.tech/app",
      debugMode: true,
      qstash: {
        currentSigningKey: null,
        enabled: false,
        nextSigningKey: null,
        schedule: null,
        token: null,
      },
      redis: {
        restToken: "redis-token",
        restUrl: "https://example.upstash.io",
      },
      rpc: {
        base: "",
        ethereum: "",
        optimism: "",
      },
    });

    restoreProcess();
  });

  it("fails safely when no process environment is available", () => {
    setProcessEnv(undefined);

    expect(() => loadConfig()).toThrowError(ConfigError);
    expect(() => loadConfig()).toThrowError(
      "DATABASE_URL: Invalid input: expected string, received null",
    );

    restoreProcess();
  });

  it("maps root-level schema issues to the ENV key", () => {
    expect(
      parseEnvironmentObject({
        DATABASE_URL: "postgresql://user:password@example.neon.tech/app",
        DEBUG_MODE: null,
        KV_REST_API_TOKEN: null,
        KV_REST_API_URL: null,
        QSTASH_CURRENT_SIGNING_KEY: null,
        QSTASH_NEXT_SIGNING_KEY: null,
        QSTASH_SCHEDULE_CRON: null,
        QSTASH_SCHEDULE_DESTINATION: null,
        QSTASH_TOKEN: null,
        RPC_URL_BASE: null,
        RPC_URL_ETHEREUM: null,
        RPC_URL_OPTIMISM: null,
        UPSTASH_REDIS_REST_TOKEN: null,
        UPSTASH_REDIS_REST_URL: null,
        UNEXPECTED: true,
      }),
    ).toEqual({
      success: false,
      issues: [
        {
          key: "ENV",
          message: 'Unrecognized key: "UNEXPECTED"',
        },
      ],
    });
  });

  it("fails when debug mode is malformed", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://user:password@example.neon.tech/app",
        DEBUG_MODE: "yes",
        UPSTASH_REDIS_REST_TOKEN: "redis-token",
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      }),
    ).toThrowError(
      "DEBUG_MODE: Invalid option: expected one of \"true\"|\"false\"",
    );
  });
});
