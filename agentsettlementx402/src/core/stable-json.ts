import { createHash } from "node:crypto";

const stringifyStableObject = (value: Record<string, unknown>): string => {
  const keys = Object.keys(value).sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
};

export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  return stringifyStableObject(value as Record<string, unknown>);
};

export const hashStableJson = (value: unknown): string => {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
};
