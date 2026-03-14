import { describe, expect, it } from "vitest";

import * as dbExports from "../../src/db/index.js";

describe("db barrel exports", () => {
  it("re-exports schema, repositories, and adapters", () => {
    expect(dbExports.agents).toBeDefined();
    expect(dbExports.dbModuleExports.schema.agents).toBeDefined();
    expect(dbExports.repositoryContractNames).toEqual([
      "agents",
      "agentCards",
      "wallets",
      "services",
      "attemptGroups",
      "paymentEvents",
      "linkEdges",
      "observableMetrics",
    ]);
    expect(typeof dbExports.DrizzleAgentRepository).toBe("function");
  });
});
