import { describe, expect, it } from "vitest";

import {
  createStructuredLogger,
  redactLogContext,
  redactLogValue,
  serializeLogRecord,
} from "../../src/observability/index.js";

describe("observability logger redaction", () => {
  it("redacts payer identities and raw payloads in log contexts", () => {
    expect(
      redactLogContext({
        nested: {
          payer: "0xabc",
        },
        payer: "0xpayer123456",
        rawJson: {
          private: true,
        },
      }),
    ).toEqual({
      nested: {
        payer: "[REDACTED]",
      },
      payer: "0xpaye...[REDACTED]",
      rawJson: "[REDACTED]",
    });
  });

  it("redacts payer arrays and non-string sensitive values", () => {
    expect(redactLogValue("payerIds", ["0xabc1234567", "0xdef1234567"])).toEqual([
      "[REDACTED]",
      "[REDACTED]",
    ]);
    expect(redactLogValue("token", 123)).toBe("[REDACTED]");
    expect(redactLogValue("tags", ["alpha", "beta"])).toEqual(["alpha", "beta"]);
    expect(redactLogValue("optional", null)).toBeNull();
    expect(redactLogValue("optional", undefined)).toBeUndefined();
  });

  it("serializes structured records as JSON with redacted context", () => {
    const line = serializeLogRecord({
      context: {
        payer: "0xpayer123456",
      },
      level: "info",
      message: "request",
      timestamp: "2026-03-13T00:00:00.000Z",
    });

    expect(line).toContain("\"level\":\"info\"");
    expect(line).not.toContain("0xpayer123456");
    expect(
      serializeLogRecord({
        level: "info",
        message: "request_without_context",
        timestamp: "2026-03-13T00:00:00.000Z",
      }),
    ).toContain("request_without_context");
  });

  it("skips debug output when debug mode is disabled", () => {
    const lines: string[] = [];
    const logger = createStructuredLogger({
      debugEnabled: false,
      sink(line) {
        lines.push(line);
      },
    });

    logger.debug("hidden");
    logger.info("shown");
    logger.error("failed");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("shown");
    expect(lines[1]).toContain("failed");
  });

  it("uses default options safely when no logger options are provided", () => {
    const lines: string[] = [];
    const originalConsoleLog = console.log;
    console.log = (line?: unknown) => {
      lines.push(String(line));
    };

    try {
      const logger = createStructuredLogger();
      logger.info("default_logger");
    } finally {
      console.log = originalConsoleLog;
    }

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("default_logger");
  });
});
