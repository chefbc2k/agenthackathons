const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|payer|rawjson|rawsourcejson|rawpayload|payload)/i;

export type StructuredLogLevel = "debug" | "info" | "warn" | "error";

export interface StructuredLogRecord {
  readonly level: StructuredLogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly context?: Record<string, unknown>;
}

export interface StructuredLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface StructuredLoggerOptions {
  readonly debugEnabled?: boolean;
  readonly sink?: (line: string) => void;
}

const isSensitiveKey = (key: string): boolean => {
  return SENSITIVE_KEY_PATTERN.test(key);
};

const redactAddress = (value: string): string => {
  return value.length <= 10
    ? "[REDACTED]"
    : `${value.slice(0, 6)}...[REDACTED]`;
};

export const redactLogValue = (key: string, value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    if (isSensitiveKey(key)) {
      return value.map(() => "[REDACTED]");
    }

    return value.map((entry) => redactLogValue(key, entry));
  }

  if (typeof value === "object") {
    if (isSensitiveKey(key)) {
      return "[REDACTED]";
    }

    return redactLogContext(value as Record<string, unknown>);
  }

  if (!isSensitiveKey(key)) {
    return value;
  }

  if (typeof value === "string" && /payer/i.test(key)) {
    return redactAddress(value);
  }

  return "[REDACTED]";
};

export const redactLogContext = (
  context: Record<string, unknown>,
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, redactLogValue(key, value)]),
  );
};

export const serializeLogRecord = (record: StructuredLogRecord): string => {
  return JSON.stringify(
    record.context
      ? {
          context: redactLogContext(record.context),
          level: record.level,
          message: record.message,
          timestamp: record.timestamp,
        }
      : {
          level: record.level,
          message: record.message,
          timestamp: record.timestamp,
        },
  );
};

export const createStructuredLogger = (
  options: StructuredLoggerOptions = {},
): StructuredLogger => {
  const debugEnabled = options.debugEnabled ?? false;
  const sink = options.sink ?? ((line: string) => console.log(line));

  const write = (
    level: StructuredLogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void => {
    if (level === "debug" && !debugEnabled) {
      return;
    }

    sink(
      serializeLogRecord(
        context
          ? {
              context,
              level,
              message,
              timestamp: new Date().toISOString(),
            }
          : {
              level,
              message,
              timestamp: new Date().toISOString(),
            },
      ),
    );
  };

  return {
    debug(message, context) {
      write("debug", message, context);
    },
    error(message, context) {
      write("error", message, context);
    },
    info(message, context) {
      write("info", message, context);
    },
    warn(message, context) {
      write("warn", message, context);
    },
  };
};
