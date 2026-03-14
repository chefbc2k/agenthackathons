import * as observable from "./observable.js";
import * as persist from "./persist.js";

export const metricsModuleExports = {
  observable,
  persist,
} as const;

export * from "./observable.js";
export * from "./persist.js";
