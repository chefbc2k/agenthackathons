import * as logger from "./logger.js";

export const observabilityModuleExports = {
  logger,
} as const;

export * from "./logger.js";
