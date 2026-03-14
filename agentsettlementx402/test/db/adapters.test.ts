import { describe, expect, it, vi } from "vitest";

import {
  DrizzleAgentCardRepository,
  DrizzleAgentRepository,
  DrizzleAttemptGroupRepository,
  DrizzleLinkEdgeRepository,
  DrizzleObservableMetricsRepository,
  DrizzlePaymentEventRepository,
  DrizzleServiceRepository,
  DrizzleWalletRepository,
  type AgentCardStore,
  type AgentStore,
  type AttemptGroupStore,
  type LinkEdgeStore,
  type ObservableMetricsStore,
  type PaymentEventStore,
  type ServiceStore,
  type WalletStore,
} from "../../src/db/adapters.js";

describe("DrizzleAgentRepository", () => {
  it("delegates create and lookup to the store", async () => {
    const store: AgentStore = {
      insert: vi.fn().mockResolvedValue({
        id: "agent-1",
        agentCardUrl: "https://example.com/agent-card.json",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        providerOrganization: null,
        providerUrl: null,
        displayName: "Agent",
        updatedAt: new Date("2026-03-13T00:00:00.000Z"),
      }),
      selectByAgentCardUrl: vi.fn().mockResolvedValue(null),
      updateByAgentCardUrl: vi.fn(),
    };
    const repository = new DrizzleAgentRepository(store);

    await expect(
      repository.create({
        agentCardUrl: "https://example.com/agent-card.json",
        providerOrganization: null,
        providerUrl: null,
        displayName: "Agent",
      }),
    ).resolves.toEqual({
        id: "agent-1",
        agentCardUrl: "https://example.com/agent-card.json",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        providerOrganization: null,
        providerUrl: null,
        displayName: "Agent",
        updatedAt: new Date("2026-03-13T00:00:00.000Z"),
      });
    await expect(
      repository.findByAgentCardUrl("https://example.com/agent-card.json"),
    ).resolves.toBeNull();
  });

  it("updates an existing agent when upserting by agent-card URL", async () => {
    const insert = vi.fn();
    const updateByAgentCardUrl = vi.fn().mockResolvedValue({
      id: "agent-1",
      agentCardUrl: "https://example.com/agent-card.json",
      createdAt: new Date("2026-03-13T00:00:00.000Z"),
      providerOrganization: "Example Org",
      providerUrl: "https://example.com",
      displayName: "Updated Agent",
      updatedAt: new Date("2026-03-14T00:00:00.000Z"),
    });
    const store: AgentStore = {
      insert,
      selectByAgentCardUrl: vi.fn().mockResolvedValue({
        id: "agent-1",
        agentCardUrl: "https://example.com/agent-card.json",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        providerOrganization: null,
        providerUrl: null,
        displayName: "Agent",
        updatedAt: new Date("2026-03-13T00:00:00.000Z"),
      }),
      updateByAgentCardUrl,
    };
    const repository = new DrizzleAgentRepository(store);

    await expect(
      repository.upsert({
        agentCardUrl: "https://example.com/agent-card.json",
        displayName: "Updated Agent",
        providerOrganization: "Example Org",
        providerUrl: "https://example.com",
      }),
    ).resolves.toMatchObject({
      displayName: "Updated Agent",
      providerOrganization: "Example Org",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("creates a new agent when upserting a new agent-card URL", async () => {
    const insert = vi.fn().mockResolvedValue({
      id: "agent-2",
      agentCardUrl: "https://new.example.com/agent-card.json",
      createdAt: new Date("2026-03-13T00:00:00.000Z"),
      providerOrganization: null,
      providerUrl: null,
      displayName: "New Agent",
      updatedAt: new Date("2026-03-13T00:00:00.000Z"),
    });
    const updateByAgentCardUrl = vi.fn();
    const store: AgentStore = {
      insert,
      selectByAgentCardUrl: vi.fn().mockResolvedValue(null),
      updateByAgentCardUrl,
    };
    const repository = new DrizzleAgentRepository(store);

    await expect(
      repository.upsert({
        agentCardUrl: "https://new.example.com/agent-card.json",
        displayName: "New Agent",
        providerOrganization: null,
        providerUrl: null,
      }),
    ).resolves.toMatchObject({
      id: "agent-2",
      displayName: "New Agent",
    });
    expect(updateByAgentCardUrl).not.toHaveBeenCalled();
  });
});

describe("DrizzleAgentCardRepository", () => {
  it("inserts when no existing agent card is present", async () => {
    const updateByAgentId = vi.fn();
    const store: AgentCardStore = {
      insert: vi.fn().mockResolvedValue({
        id: "card-1",
        agentId: "agent-1",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        discoveredAt: new Date("2026-03-13T00:00:00.000Z"),
        rawJson: {},
        rawJsonHash: "hash-1",
        normalizedJson: {},
        documentationUrl: null,
        description: null,
        signatureVerificationStatus: "unverified",
        updatedAt: new Date("2026-03-13T00:00:00.000Z"),
      }),
      selectByAgentId: vi.fn().mockResolvedValue(null),
      updateByAgentId,
    };
    const repository = new DrizzleAgentCardRepository(store);

    await expect(
      repository.upsert({
        agentId: "agent-1",
        rawJsonHash: "hash-1",
        rawJson: {},
        normalizedJson: {},
        documentationUrl: null,
        description: null,
        signatureVerificationStatus: "unverified",
      }),
    ).resolves.toEqual({
        id: "card-1",
        agentId: "agent-1",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        discoveredAt: new Date("2026-03-13T00:00:00.000Z"),
        rawJson: {},
        rawJsonHash: "hash-1",
        normalizedJson: {},
        documentationUrl: null,
        description: null,
        signatureVerificationStatus: "unverified",
        updatedAt: new Date("2026-03-13T00:00:00.000Z"),
      });
    expect(updateByAgentId).not.toHaveBeenCalled();
  });

  it("updates when an agent card already exists", async () => {
    const insert = vi.fn();
    const store: AgentCardStore = {
      insert,
      selectByAgentId: vi.fn().mockResolvedValue({
        id: "card-1",
        agentId: "agent-1",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        discoveredAt: new Date("2026-03-13T00:00:00.000Z"),
        rawJson: {},
        rawJsonHash: "hash-1",
        normalizedJson: {},
        documentationUrl: null,
        description: null,
        signatureVerificationStatus: "unverified",
        updatedAt: new Date("2026-03-13T00:00:00.000Z"),
      }),
      updateByAgentId: vi.fn().mockResolvedValue({
        id: "card-1",
        agentId: "agent-1",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        discoveredAt: new Date("2026-03-14T00:00:00.000Z"),
        rawJson: { updated: true },
        rawJsonHash: "hash-2",
        normalizedJson: { updated: true },
        documentationUrl: "https://example.com/docs",
        description: "updated",
        signatureVerificationStatus: "verified",
        updatedAt: new Date("2026-03-14T00:00:00.000Z"),
      }),
    };
    const repository = new DrizzleAgentCardRepository(store);

    await expect(
      repository.upsert({
        agentId: "agent-1",
        rawJson: { updated: true },
        rawJsonHash: "hash-2",
        normalizedJson: { updated: true },
        documentationUrl: "https://example.com/docs",
        description: "updated",
        signatureVerificationStatus: "verified",
      }),
    ).resolves.toEqual({
        id: "card-1",
        agentId: "agent-1",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        discoveredAt: new Date("2026-03-14T00:00:00.000Z"),
        rawJson: { updated: true },
        rawJsonHash: "hash-2",
        normalizedJson: { updated: true },
        documentationUrl: "https://example.com/docs",
        description: "updated",
        signatureVerificationStatus: "verified",
        updatedAt: new Date("2026-03-14T00:00:00.000Z"),
      });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns null for a missing card lookup", async () => {
    const store: AgentCardStore = {
      insert: vi.fn(),
      selectByAgentId: vi.fn().mockResolvedValue(null),
      updateByAgentId: vi.fn(),
    };
    const repository = new DrizzleAgentCardRepository(store);

    await expect(repository.findByAgentId("missing-agent")).resolves.toBeNull();
  });
});

describe("DrizzleWalletRepository", () => {
  it("delegates lookup by address and network", async () => {
    const store: WalletStore = {
      insert: vi.fn(),
      selectByAddressAndNetwork: vi.fn().mockResolvedValue(null),
    };
    const repository = new DrizzleWalletRepository(store);

    await expect(
      repository.findByAddressAndNetwork("0xabc", "eip155:84532"),
    ).resolves.toBeNull();
  });

  it("returns the existing wallet when found", async () => {
    const insert = vi.fn();
    const store: WalletStore = {
      insert,
      selectByAddressAndNetwork: vi.fn().mockResolvedValue({
        id: "wallet-1",
        address: "0xabc",
        network: "eip155:84532",
      }),
    };
    const repository = new DrizzleWalletRepository(store);

    await expect(
      repository.upsert({
        address: "0xabc",
        network: "eip155:84532",
      }),
    ).resolves.toEqual({
      id: "wallet-1",
      address: "0xabc",
      network: "eip155:84532",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("creates a new wallet when none exists", async () => {
    const store: WalletStore = {
      insert: vi.fn().mockResolvedValue({
        id: "wallet-2",
        address: "0xdef",
        network: "eip155:84532",
      }),
      selectByAddressAndNetwork: vi.fn().mockResolvedValue(null),
    };
    const repository = new DrizzleWalletRepository(store);

    await expect(
      repository.upsert({
        address: "0xdef",
        network: "eip155:84532",
      }),
    ).resolves.toEqual({
      id: "wallet-2",
      address: "0xdef",
      network: "eip155:84532",
    });
  });
});

describe("DrizzleServiceRepository", () => {
  it("creates a service when the resource is new", async () => {
    const updateByLocator = vi.fn();
    const store: ServiceStore = {
      insert: vi.fn().mockResolvedValue({
        id: "service-1",
        resourceUrl: "https://example.com/resource",
        payToWalletId: "wallet-1",
        network: "eip155:84532",
        scheme: "exact",
        asset: null,
        amount: null,
        mimeType: null,
        description: null,
        inputSchemaUrl: null,
        outputSchemaUrl: null,
        schemaId: null,
        rawSourceJson: { resource: "https://example.com/resource" },
        sourceFingerprint: "fingerprint-1",
      }),
      selectByLocator: vi.fn().mockResolvedValue(null),
      selectByResourceUrl: vi.fn().mockResolvedValue(null),
      updateByLocator,
    };
    const repository = new DrizzleServiceRepository(store);

    await expect(
      repository.upsert({
        resourceUrl: "https://example.com/resource",
        payToWalletId: "wallet-1",
        network: "eip155:84532",
        scheme: "exact",
        asset: null,
        amount: null,
        mimeType: null,
        description: null,
        inputSchemaUrl: null,
        outputSchemaUrl: null,
        schemaId: null,
        rawSourceJson: { resource: "https://example.com/resource" },
        sourceFingerprint: "fingerprint-1",
      }),
    ).resolves.toEqual({
      id: "service-1",
      resourceUrl: "https://example.com/resource",
      payToWalletId: "wallet-1",
      network: "eip155:84532",
      scheme: "exact",
      asset: null,
      amount: null,
      mimeType: null,
      description: null,
      inputSchemaUrl: null,
      outputSchemaUrl: null,
      schemaId: null,
      rawSourceJson: { resource: "https://example.com/resource" },
      sourceFingerprint: "fingerprint-1",
    });
    expect(updateByLocator).not.toHaveBeenCalled();
  });

  it("updates a service when the resource already exists", async () => {
    const store: ServiceStore = {
      insert: vi.fn(),
      selectByLocator: vi.fn().mockResolvedValue({
        id: "service-1",
        resourceUrl: "https://example.com/resource",
        payToWalletId: "wallet-1",
        network: "eip155:84532",
        scheme: "exact",
        asset: null,
        amount: null,
        mimeType: null,
        description: null,
        inputSchemaUrl: null,
        outputSchemaUrl: null,
        schemaId: null,
        rawSourceJson: { stale: true },
        sourceFingerprint: "fingerprint-1",
      }),
      selectByResourceUrl: vi.fn().mockResolvedValue(null),
      updateByLocator: vi.fn().mockResolvedValue({
        id: "service-1",
        resourceUrl: "https://example.com/resource",
        payToWalletId: "wallet-1",
        network: "eip155:84532",
        scheme: "subscription",
        asset: "USDC",
        amount: "10",
        mimeType: "application/json",
        description: "updated",
        inputSchemaUrl: "https://example.com/in.json",
        outputSchemaUrl: "https://example.com/out.json",
        schemaId: "schema-v1",
        rawSourceJson: { updated: true },
        sourceFingerprint: "fingerprint-2",
      }),
    };
    const repository = new DrizzleServiceRepository(store);

    await expect(
      repository.upsert({
        resourceUrl: "https://example.com/resource",
        payToWalletId: "wallet-1",
        network: "eip155:84532",
        scheme: "subscription",
        asset: "USDC",
        amount: "10",
        mimeType: "application/json",
        description: "updated",
        inputSchemaUrl: "https://example.com/in.json",
        outputSchemaUrl: "https://example.com/out.json",
        schemaId: "schema-v1",
        rawSourceJson: { updated: true },
        sourceFingerprint: "fingerprint-2",
      }),
    ).resolves.toMatchObject({
      scheme: "subscription",
      asset: "USDC",
      amount: "10",
    });
  });

  it("returns null when a resource lookup misses", async () => {
    const store: ServiceStore = {
      insert: vi.fn(),
      selectByLocator: vi.fn().mockResolvedValue(null),
      selectByResourceUrl: vi.fn().mockResolvedValue(null),
      updateByLocator: vi.fn(),
    };
    const repository = new DrizzleServiceRepository(store);

    await expect(
      repository.findByResourceUrl("https://example.com/missing"),
    ).resolves.toBeNull();
    await expect(
      repository.findByLocator({
        resourceUrl: "https://example.com/missing",
        network: "eip155:84532",
        scheme: "exact",
      }),
    ).resolves.toBeNull();
  });
});

describe("DrizzleAttemptGroupRepository", () => {
  it("returns null for a missing attempt-group lookup", async () => {
    const store: AttemptGroupStore = {
      insert: vi.fn(),
      selectByPaymentIdentifier: vi.fn().mockResolvedValue(null),
    };
    const repository = new DrizzleAttemptGroupRepository(store);

    await expect(repository.findByPaymentIdentifier("missing")).resolves.toBeNull();
  });

  it("reuses an existing attempt group", async () => {
    const store: AttemptGroupStore = {
      insert: vi.fn(),
      selectByPaymentIdentifier: vi.fn().mockResolvedValue({
        id: "attempt-1",
        paymentIdentifier: "pid-1",
      }),
    };
    const repository = new DrizzleAttemptGroupRepository(store);

    await expect(
      repository.upsert({
        paymentIdentifier: "pid-1",
      }),
    ).resolves.toEqual({
      id: "attempt-1",
      paymentIdentifier: "pid-1",
    });
  });

  it("creates an attempt group when not found", async () => {
    const store: AttemptGroupStore = {
      insert: vi.fn().mockResolvedValue({
        id: "attempt-2",
        paymentIdentifier: "pid-2",
      }),
      selectByPaymentIdentifier: vi.fn().mockResolvedValue(null),
    };
    const repository = new DrizzleAttemptGroupRepository(store);

    await expect(
      repository.upsert({
        paymentIdentifier: "pid-2",
      }),
    ).resolves.toEqual({
      id: "attempt-2",
      paymentIdentifier: "pid-2",
    });
  });
});

describe("DrizzlePaymentEventRepository", () => {
  it("delegates creation and not-found lookup", async () => {
    const observedAt = new Date("2026-03-13T12:00:00.000Z");
    const store: PaymentEventStore = {
      insert: vi.fn().mockResolvedValue({
        id: "payment-1",
        attemptGroupId: null,
        payerWalletId: null,
        payToWalletId: "wallet-1",
        txHash: "0xtx",
        network: "eip155:84532",
        asset: "USDC",
        amount: "1000",
        observedAt,
        confidenceTier: "high",
        confidenceScore: 900,
        source: "bazaar",
        sourceReference: null,
      }),
      selectByTransaction: vi.fn().mockResolvedValue(null),
    };
    const repository = new DrizzlePaymentEventRepository(store);

    await expect(
      repository.create({
        attemptGroupId: null,
        payerWalletId: null,
        payToWalletId: "wallet-1",
        txHash: "0xtx",
        network: "eip155:84532",
        asset: "USDC",
        amount: "1000",
        observedAt,
        confidenceTier: "high",
        confidenceScore: 900,
        source: "bazaar",
        sourceReference: null,
      }),
    ).resolves.toMatchObject({
      id: "payment-1",
      txHash: "0xtx",
      confidenceTier: "high",
    });
    await expect(
      repository.findByTransaction("0xmissing", "eip155:84532"),
    ).resolves.toBeNull();
  });
});

describe("DrizzleLinkEdgeRepository", () => {
  it("inserts a new edge when the path is new", async () => {
    const store: LinkEdgeStore = {
      insert: vi.fn().mockResolvedValue({
        id: "edge-1",
        kind: "agent_to_service",
        sourceNodeKind: "agent",
        sourceNodeId: "agent-1",
        targetNodeKind: "service",
        targetNodeId: "service-1",
        confidenceTier: "high",
        confidenceScore: 800,
        evidenceCount: 2,
      }),
      selectByPath: vi.fn().mockResolvedValue(null),
      updateByPath: vi.fn(),
    };
    const repository = new DrizzleLinkEdgeRepository(store);

    await expect(
      repository.upsert({
        kind: "agent_to_service",
        sourceNodeKind: "agent",
        sourceNodeId: "agent-1",
        targetNodeKind: "service",
        targetNodeId: "service-1",
        confidenceTier: "high",
        confidenceScore: 800,
        evidenceCount: 2,
      }),
    ).resolves.toMatchObject({
      id: "edge-1",
      kind: "agent_to_service",
    });
  });

  it("updates an existing edge when the path already exists", async () => {
    const store: LinkEdgeStore = {
      insert: vi.fn(),
      selectByPath: vi.fn().mockResolvedValue({
        id: "edge-1",
        kind: "service_to_wallet",
        sourceNodeKind: "service",
        sourceNodeId: "service-1",
        targetNodeKind: "wallet",
        targetNodeId: "wallet-1",
        confidenceTier: "medium",
        confidenceScore: 500,
        evidenceCount: 1,
      }),
      updateByPath: vi.fn().mockResolvedValue({
        id: "edge-1",
        kind: "service_to_wallet",
        sourceNodeKind: "service",
        sourceNodeId: "service-1",
        targetNodeKind: "wallet",
        targetNodeId: "wallet-1",
        confidenceTier: "verified",
        confidenceScore: 1000,
        evidenceCount: 3,
      }),
    };
    const repository = new DrizzleLinkEdgeRepository(store);

    await expect(
      repository.upsert({
        kind: "service_to_wallet",
        sourceNodeKind: "service",
        sourceNodeId: "service-1",
        targetNodeKind: "wallet",
        targetNodeId: "wallet-1",
        confidenceTier: "verified",
        confidenceScore: 1000,
        evidenceCount: 3,
      }),
    ).resolves.toMatchObject({
      confidenceTier: "verified",
      confidenceScore: 1000,
      evidenceCount: 3,
    });
  });

  it("returns null for a missing edge path lookup", async () => {
    const store: LinkEdgeStore = {
      insert: vi.fn(),
      selectByPath: vi.fn().mockResolvedValue(null),
      updateByPath: vi.fn(),
    };
    const repository = new DrizzleLinkEdgeRepository(store);

    await expect(
      repository.findByPath({
        kind: "service_to_wallet",
        sourceNodeKind: "service",
        sourceNodeId: "service-1",
        targetNodeKind: "wallet",
        targetNodeId: "wallet-missing",
      }),
    ).resolves.toBeNull();
  });
});

describe("DrizzleObservableMetricsRepository", () => {
  it("inserts a new observable metrics snapshot when the pair is new", async () => {
    const updateByAgentAndService = vi.fn();
    const store: ObservableMetricsStore = {
      insert: vi.fn().mockResolvedValue({
        agentId: "agent-1",
        asOf: new Date("2026-03-13T12:00:00.000Z"),
        derivedProxies: {
          retryIntensity: {
            attemptsWithGroupKey: 2,
            averageAttemptsPerGroup: 2,
            groupedAttemptCount: 1,
            groupsWithRetries: 1,
          },
        },
        metricsFingerprint: "fingerprint-1",
        recency: {
          eventCount7d: 2,
          eventCount30d: 4,
          uniquePayerCount7d: 1,
          uniquePayerCount30d: 2,
        },
        serviceId: "service-1",
        success: {
          failureCount: 1,
          observableAttemptCount: 2,
          successCount: 1,
          successRate: 0.5,
        },
        usage: {
          eventCount: 4,
          uniquePayerCount: 2,
        },
      }),
      selectByAgentAndService: vi.fn().mockResolvedValue(null),
      updateByAgentAndService,
    };
    const repository = new DrizzleObservableMetricsRepository(store);

    await expect(
      repository.upsert({
        agentId: "agent-1",
        asOf: new Date("2026-03-13T12:00:00.000Z"),
        derivedProxies: {
          retryIntensity: {
            attemptsWithGroupKey: 2,
            averageAttemptsPerGroup: 2,
            groupedAttemptCount: 1,
            groupsWithRetries: 1,
          },
        },
        metricsFingerprint: "fingerprint-1",
        recency: {
          eventCount7d: 2,
          eventCount30d: 4,
          uniquePayerCount7d: 1,
          uniquePayerCount30d: 2,
        },
        serviceId: "service-1",
        success: {
          failureCount: 1,
          observableAttemptCount: 2,
          successCount: 1,
          successRate: 0.5,
        },
        usage: {
          eventCount: 4,
          uniquePayerCount: 2,
        },
      }),
    ).resolves.toMatchObject({
      agentId: "agent-1",
      serviceId: "service-1",
      metricsFingerprint: "fingerprint-1",
    });
    expect(updateByAgentAndService).not.toHaveBeenCalled();
  });

  it("updates an existing observable metrics snapshot when the pair exists", async () => {
    const insert = vi.fn();
    const store: ObservableMetricsStore = {
      insert,
      selectByAgentAndService: vi.fn().mockResolvedValue({
        agentId: "agent-1",
        asOf: new Date("2026-03-12T12:00:00.000Z"),
        derivedProxies: {
          retryIntensity: {
            attemptsWithGroupKey: 1,
            averageAttemptsPerGroup: 1,
            groupedAttemptCount: 1,
            groupsWithRetries: 0,
          },
        },
        metricsFingerprint: "old-fingerprint",
        recency: {
          eventCount7d: 1,
          eventCount30d: 2,
          uniquePayerCount7d: 1,
          uniquePayerCount30d: 1,
        },
        serviceId: "service-1",
        success: {
          failureCount: 0,
          observableAttemptCount: 1,
          successCount: 1,
          successRate: 1,
        },
        usage: {
          eventCount: 2,
          uniquePayerCount: 1,
        },
      }),
      updateByAgentAndService: vi.fn().mockResolvedValue({
        agentId: "agent-1",
        asOf: new Date("2026-03-13T12:00:00.000Z"),
        derivedProxies: {
          retryIntensity: {
            attemptsWithGroupKey: 2,
            averageAttemptsPerGroup: 2,
            groupedAttemptCount: 1,
            groupsWithRetries: 1,
          },
        },
        metricsFingerprint: "fingerprint-1",
        recency: {
          eventCount7d: 2,
          eventCount30d: 4,
          uniquePayerCount7d: 1,
          uniquePayerCount30d: 2,
        },
        serviceId: "service-1",
        success: {
          failureCount: 1,
          observableAttemptCount: 2,
          successCount: 1,
          successRate: 0.5,
        },
        usage: {
          eventCount: 4,
          uniquePayerCount: 2,
        },
      }),
    };
    const repository = new DrizzleObservableMetricsRepository(store);

    await expect(
      repository.upsert({
        agentId: "agent-1",
        asOf: new Date("2026-03-13T12:00:00.000Z"),
        derivedProxies: {
          retryIntensity: {
            attemptsWithGroupKey: 2,
            averageAttemptsPerGroup: 2,
            groupedAttemptCount: 1,
            groupsWithRetries: 1,
          },
        },
        metricsFingerprint: "fingerprint-1",
        recency: {
          eventCount7d: 2,
          eventCount30d: 4,
          uniquePayerCount7d: 1,
          uniquePayerCount30d: 2,
        },
        serviceId: "service-1",
        success: {
          failureCount: 1,
          observableAttemptCount: 2,
          successCount: 1,
          successRate: 0.5,
        },
        usage: {
          eventCount: 4,
          uniquePayerCount: 2,
        },
      }),
    ).resolves.toMatchObject({
      metricsFingerprint: "fingerprint-1",
      serviceId: "service-1",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns null for a missing observable metrics lookup", async () => {
    const store: ObservableMetricsStore = {
      insert: vi.fn(),
      selectByAgentAndService: vi.fn().mockResolvedValue(null),
      updateByAgentAndService: vi.fn(),
    };
    const repository = new DrizzleObservableMetricsRepository(store);

    await expect(
      repository.findByAgentAndService("agent-1", "service-1"),
    ).resolves.toBeNull();
  });
});
