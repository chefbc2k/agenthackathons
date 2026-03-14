const SENSITIVE_KEY_PATTERN = /(token|secret|password|key)/i;

const redactUrlCredentials = (value: string): string => {
  try {
    const url = new URL(value);

    if (url.username) {
      url.username = "[REDACTED]";
    }

    if (url.password) {
      url.password = "[REDACTED]";
    }

    if (url.search) {
      url.search = "";
    }

    return url.toString();
  } catch {
    return value;
  }
};

export const redactConfigValue = (key: string, value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : redactConfigValue(key, entry),
    );
  }

  if (typeof value === "object") {
    return redactConfigObject(value as Record<string, unknown>);
  }

  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    return redactUrlCredentials(value);
  }

  return value;
};

export const redactConfigObject = (
  value: Record<string, unknown>,
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      redactConfigValue(key, entry),
    ]),
  );
};

export const serializeConfigForDebug = (
  value: Record<string, unknown>,
): string => {
  return JSON.stringify(redactConfigObject(value), null, 2);
};
