import { describe, expect, it, vi } from "vitest";

import type {
  AgentCardRepository,
  AgentRepository,
} from "../../../src/db/repositories.js";
import {
  A2aPersistenceError,
  hashStableJson,
  persistIngestedAgentCard,
} from "../../../src/ingest/a2a/persist.js";

const baseValidatedResult = {
  agent: {
    agentCardUrl: "https://example.com/.well-known/agent-card.json",
    displayName: "Agent Example",
    providerOrganization: "Example Org",
    providerUrl: "https://example.com",
  },
  agentCard: {
    description: "Agent description",
    documentationUrl: "https://example.com/docs",
    normalizedJson: {
      agentCardUrl: "https://example.com/.well-known/agent-card.json",
      capabilities: {
        pushNotifications: false,
        stateTransitionHistory: false,
        streaming: false,
      },
      defaultInputModes: [],
      defaultOutputModes: [],
      description: "Agent description",
      documentationUrl: "https://example.com/docs",
      extensions: [],
      name: "Agent Example",
      provider: {
        organization: "Example Org",
        url: "https://example.com",
      },
      signatureMetadata: [],
      skills: [],
    },
    rawJson: {
      name: "Agent Example",
      provider: {
        organization: "Example Org",
        url: "https://example.com",
      },
      url: "https://example.com/.well-known/agent-card.json",
    },
    signatureVerificationStatus: "unverified" as const,
  },
  domain: "example.com",
  fetchedAt: new Date("2026-03-13T00:00:00.000Z"),
  httpStatus: 200,
  issues: [],
  rawJson: {
    name: "Agent Example",
    provider: {
      organization: "Example Org",
      url: "https://example.com",
    },
    url: "https://example.com/.well-known/agent-card.json",
  },
  sourceUrl: "https://example.com/.well-known/agent-card.json",
  validationStatus: "validated" as const,
};

const createRepositories = ({
  existingAgentCard,
}: {
  readonly existingAgentCard: Awaited<
    ReturnType<AgentCardRepository["findByAgentId"]>
  >;
}) => {
  const upsertAgent = vi.fn().mockResolvedValue({
    id: "agent-1",
    agentCardUrl: "https://example.com/.well-known/agent-card.json",
    displayName: "Agent Example",
    providerOrganization: "Example Org",
    providerUrl: "https://example.com",
  });
  const upsertAgentCard = vi
    .fn<(input: Parameters<AgentCardRepository["upsert"]>[0]) => Promise<Awaited<ReturnType<AgentCardRepository["upsert"]>>>>()
    .mockImplementation((input) =>
      Promise.resolve({
        id: "card-1",
        agentId: input.agentId,
        rawJson: input.rawJson,
        rawJsonHash: input.rawJsonHash,
        normalizedJson: input.normalizedJson,
        documentationUrl: input.documentationUrl,
        description: input.description,
        signatureVerificationStatus: input.signatureVerificationStatus,
      }),
    );
  const agents: AgentRepository = {
    create: vi.fn(),
    findByAgentCardUrl: vi.fn(),
    upsert: upsertAgent,
  };
  const agentCards: AgentCardRepository = {
    findByAgentId: vi.fn().mockResolvedValue(existingAgentCard),
    upsert: upsertAgentCard,
  };

  return {
    agentCards,
    agents,
    mocks: {
      upsertAgent,
      upsertAgentCard,
    },
  };
};

describe("hashStableJson", () => {
  it("produces the same hash for objects with different key order", () => {
    expect(hashStableJson({ b: 2, a: 1 })).toBe(
      hashStableJson({ a: 1, b: 2 }),
    );
  });

  it("produces different hashes when the payload changes", () => {
    expect(hashStableJson({ a: 1 })).not.toBe(hashStableJson({ a: 2 }));
  });

  it("hashes arrays and nested objects deterministically", () => {
    expect(
      hashStableJson([
        { b: 2, a: 1 },
        ["x", "y"],
      ]),
    ).toBe(
      hashStableJson([
        { a: 1, b: 2 },
        ["x", "y"],
      ]),
    );
  });
});

describe("persistIngestedAgentCard", () => {
  it("inserts a new agent-card record when none exists", async () => {
    const repositories = createRepositories({
      existingAgentCard: null,
    });

    await expect(
      persistIngestedAgentCard(baseValidatedResult, repositories),
    ).resolves.toEqual({
      action: "created",
      agent: {
        id: "agent-1",
        agentCardUrl: "https://example.com/.well-known/agent-card.json",
        displayName: "Agent Example",
        providerOrganization: "Example Org",
        providerUrl: "https://example.com",
      },
      agentCard: {
        id: "card-1",
        agentId: "agent-1",
        rawJson: baseValidatedResult.rawJson,
        rawJsonHash: hashStableJson(baseValidatedResult.rawJson),
        normalizedJson: baseValidatedResult.agentCard.normalizedJson,
        documentationUrl: "https://example.com/docs",
        description: "Agent description",
        signatureVerificationStatus: "unverified",
      },
      rawJsonHash: hashStableJson(baseValidatedResult.rawJson),
      sourceUrl: "https://example.com/.well-known/agent-card.json",
    });
  });

  it("updates an existing agent-card record when the hash changes", async () => {
    const repositories = createRepositories({
      existingAgentCard: {
        id: "card-1",
        agentId: "agent-1",
        rawJson: { stale: true },
        rawJsonHash: "old-hash",
        normalizedJson: { stale: true },
        documentationUrl: null,
        description: null,
        signatureVerificationStatus: "unverified",
      },
    });

    await expect(
      persistIngestedAgentCard(baseValidatedResult, repositories),
    ).resolves.toMatchObject({
      action: "updated",
      rawJsonHash: hashStableJson(baseValidatedResult.rawJson),
    });
    expect(repositories.mocks.upsertAgentCard).toHaveBeenCalledOnce();
  });

  it("returns a no-op when the agent-card hash is unchanged", async () => {
    const unchangedCard = {
      id: "card-1",
      agentId: "agent-1",
      rawJson: baseValidatedResult.rawJson,
      rawJsonHash: hashStableJson(baseValidatedResult.rawJson),
      normalizedJson: { persisted: true },
      documentationUrl: "https://example.com/docs",
      description: "Agent description",
      signatureVerificationStatus: "unverified" as const,
    };
    const repositories = createRepositories({
      existingAgentCard: unchangedCard,
    });

    await expect(
      persistIngestedAgentCard(baseValidatedResult, repositories),
    ).resolves.toEqual({
      action: "noop",
      agent: {
        id: "agent-1",
        agentCardUrl: "https://example.com/.well-known/agent-card.json",
        displayName: "Agent Example",
        providerOrganization: "Example Org",
        providerUrl: "https://example.com",
      },
      agentCard: unchangedCard,
      rawJsonHash: hashStableJson(baseValidatedResult.rawJson),
      sourceUrl: "https://example.com/.well-known/agent-card.json",
    });
    expect(repositories.mocks.upsertAgentCard).not.toHaveBeenCalled();
  });

  it("rejects invalid ingest results before any repository write", async () => {
    const repositories = createRepositories({
      existingAgentCard: null,
    });

    await expect(
      persistIngestedAgentCard(
        {
          ...baseValidatedResult,
          agent: null,
          agentCard: null,
          validationStatus: "schema_error",
        },
        repositories,
      ),
    ).rejects.toThrowError(A2aPersistenceError);
    expect(repositories.mocks.upsertAgent).not.toHaveBeenCalled();
  });

  it("rejects a validated result that is missing agent-card payloads", async () => {
    const repositories = createRepositories({
      existingAgentCard: null,
    });

    await expect(
      persistIngestedAgentCard(
        {
          ...baseValidatedResult,
          agent: null,
        },
        repositories,
      ),
    ).rejects.toThrowError(
      "Validated ingest result is missing agent or agent-card data",
    );
  });
});
