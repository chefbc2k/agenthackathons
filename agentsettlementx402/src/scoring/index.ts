import * as reputation from "./reputation.js";

export const scoringModuleExports = {
  reputation,
} as const;

export * from "./reputation.js";
