import { describe, expect, it } from "vitest";

import {
  redactConfigObject,
  redactConfigValue,
  serializeConfigForDebug,
} from "../../src/config/redaction.js";

describe("redaction helpers", () => {
  it("redacts sensitive keys and URL credentials", () => {
    expect(
      redactConfigObject({
        DATABASE_URL:
          "postgresql://user:password@example.neon.tech/app?sslmode=require",
        nested: {
          apiKey: "abc123",
        },
        QSTASH_TOKEN: "secret",
        safeValue: "plain-text",
      }),
    ).toEqual({
      DATABASE_URL: "postgresql://%5BREDACTED%5D:%5BREDACTED%5D@example.neon.tech/app",
      nested: {
        apiKey: "[REDACTED]",
      },
      QSTASH_TOKEN: "[REDACTED]",
      safeValue: "plain-text",
    });
  });

  it("redacts arrays and leaves nullish values untouched", () => {
    expect(
      redactConfigValue("tokens", ["a", "b"]),
    ).toEqual(["[REDACTED]", "[REDACTED]"]);
    expect(
      redactConfigValue("rpcUrls", ["https://public-a.example.com", "https://public-b.example.com"]),
    ).toEqual([
      "https://public-a.example.com/",
      "https://public-b.example.com/",
    ]);
    expect(redactConfigValue("optional", null)).toBeNull();
    expect(redactConfigValue("optional", undefined)).toBeUndefined();
  });

  it("serializes redacted debug output without leaking secrets", () => {
    const serialized = serializeConfigForDebug({
      redisToken: "redis-secret",
      rpcUrl: "https://public-rpc.example.com",
    });

    expect(serialized).toContain('"redisToken": "[REDACTED]"');
    expect(serialized).toContain('"rpcUrl": "https://public-rpc.example.com/"');
    expect(serialized).not.toContain("redis-secret");
  });

  it("leaves non-string primitive values unchanged", () => {
    expect(redactConfigValue("enabled", true)).toBe(true);
    expect(redactConfigValue("attempts", 3)).toBe(3);
  });
});
