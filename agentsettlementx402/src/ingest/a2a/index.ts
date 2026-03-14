import * as agentCards from "./agent-cards.js";
import * as persist from "./persist.js";

export const a2aIngestModuleExports = {
  agentCards,
  persist,
} as const;

export * from "./agent-cards.js";
export * from "./persist.js";
