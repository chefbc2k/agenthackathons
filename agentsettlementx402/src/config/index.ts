import * as env from "./env.js";
import * as redaction from "./redaction.js";

export const configModuleExports = {
  env,
  redaction,
} as const;

export * from "./env.js";
export * from "./redaction.js";
