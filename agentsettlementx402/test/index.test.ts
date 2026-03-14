import { describe, expect, it } from "vitest";

import {
  a2aAgentCardSchema,
  coverageGateStatus,
  ingestAgentCards,
  ingestBazaarResources,
  ingestModuleExports,
  hashStableJson,
  persistIngestedAgentCard,
  persistBazaarResource,
  linkAgentsToServices,
  parseA2aAgentCard,
  parseA2aX402TaskPaymentMetadata,
  appendA2aX402ReceiptEnvelope,
  toA2aX402PaymentAttempts,
  parseX402PaymentRequiredBody,
  parseX402SettlementResponseHeader,
  normalizeX402PaymentAttemptTranscript,
  createApiApp,
  createListCacheKey,
  createCliApiApp,
  createStructuredLogger,
  readPort,
  runApiServerFromEnvironment,
  computeMetrics,
  persistComputedMetrics,
  scoreReputation,
  parseX402PaymentRequired,
  repositoryContractNames,
  x402PaymentRequiredSchema,
} from "../src/index.js";
import * as configExports from "../src/config/index.js";
import * as dbExports from "../src/db/index.js";

describe("coverageGateStatus", () => {
  it("enforces the target when coverage drops below the hard floor", () => {
    expect(coverageGateStatus(94)).toEqual({
      floor: 95,
      target: 100,
      enforceTarget: true,
    });
  });

  it("keeps enforcing the target when coverage is between the floor and target", () => {
    expect(coverageGateStatus(99)).toEqual({
      floor: 95,
      target: 100,
      enforceTarget: true,
    });
  });

  it("stops escalation once the working target is met", () => {
    expect(coverageGateStatus(100)).toEqual({
      floor: 95,
      target: 100,
      enforceTarget: false,
    });
  });
});

describe("root exports", () => {
  it("re-exports core schemas and parsers", () => {
    expect(a2aAgentCardSchema).toBeDefined();
    expect(configExports.configModuleExports.env.loadConfig).toBeDefined();
    expect(typeof configExports.loadConfig).toBe("function");
    expect(dbExports.agents).toBeDefined();
    expect(typeof parseA2aAgentCard).toBe("function");
    expect(typeof parseA2aX402TaskPaymentMetadata).toBe("function");
    expect(typeof appendA2aX402ReceiptEnvelope).toBe("function");
    expect(typeof toA2aX402PaymentAttempts).toBe("function");
    expect(typeof hashStableJson).toBe("function");
    expect(typeof computeMetrics).toBe("function");
    expect(typeof persistComputedMetrics).toBe("function");
    expect(typeof scoreReputation).toBe("function");
    expect(x402PaymentRequiredSchema).toBeDefined();
    expect(typeof parseX402PaymentRequired).toBe("function");
    expect(typeof parseX402PaymentRequiredBody).toBe("function");
    expect(typeof parseX402SettlementResponseHeader).toBe("function");
    expect(typeof normalizeX402PaymentAttemptTranscript).toBe("function");
    expect(typeof createApiApp).toBe("function");
    expect(typeof createCliApiApp).toBe("function");
    expect(typeof createStructuredLogger).toBe("function");
    expect(typeof createListCacheKey).toBe("function");
    expect(typeof readPort).toBe("function");
    expect(typeof runApiServerFromEnvironment).toBe("function");
    expect(typeof ingestAgentCards).toBe("function");
    expect(typeof ingestBazaarResources).toBe("function");
    expect(typeof persistBazaarResource).toBe("function");
    expect(typeof linkAgentsToServices).toBe("function");
    expect(typeof ingestModuleExports.a2a.ingestAgentCards).toBe("function");
    expect(typeof ingestModuleExports.a2aX402.parseA2aX402TaskPaymentMetadata).toBe(
      "function",
    );
    expect(typeof ingestModuleExports.x402.ingestBazaarResources).toBe(
      "function",
    );
    expect(typeof persistIngestedAgentCard).toBe("function");
    expect(
      typeof ingestModuleExports.a2a.a2aIngestModuleExports.persist
        .persistIngestedAgentCard,
    ).toBe("function");
    expect(
      typeof ingestModuleExports.x402.x402IngestModuleExports.bazaar
        .ingestBazaarResources,
    ).toBe("function");
    expect(
      typeof ingestModuleExports.x402.x402IngestModuleExports.persist
        .persistBazaarResource,
    ).toBe("function");
    expect(typeof dbExports.dbModuleExports.adapters).toBe("object");
    expect(repositoryContractNames).toEqual([
      "agents",
      "agentCards",
      "wallets",
      "services",
      "attemptGroups",
      "paymentEvents",
      "linkEdges",
      "observableMetrics",
    ]);
  });
});
