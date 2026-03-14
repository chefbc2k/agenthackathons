import * as adapters from "./adapters.js";
import * as repositories from "./repositories.js";
import * as schema from "./schema.js";

export const dbModuleExports = {
  adapters,
  repositories,
  schema,
} as const;

export * from "./adapters.js";
export * from "./repositories.js";
export * from "./schema.js";
