import { describe, expect, it, vi } from "vitest";

import type { LinkEdgeRepository } from "../../src/db/repositories.js";
import {
  AgentServiceLinkPersistenceError,
  persistAgentServiceLink,
  toAgentServiceLinkEdge,
} from "../../src/linking/persist.js";

const baseLink = {
  agentId: "agent-1",
  confidence: "medium" as const,
  confidenceScore: 600,
  evidence: [
    {
      declarationSource: null,
      matchedAgentHostname: "example.com",
      matchedPayToAddress: "0xabc",
      matchedResourceHostname: "example.com",
      proofOfOwnership: false,
      rule: "domain_match" as const,
      signatureVerified: false,
      summary: "matched",
    },
  ],
  serviceId: "service-1",
};

const createRepository = (
  existing: ReturnType<typeof toAgentServiceLinkEdge> | null = null,
): {
  readonly repository: LinkEdgeRepository;
  readonly upsert: ReturnType<typeof vi.fn>;
} => {
  const upsert = vi.fn((input: Parameters<LinkEdgeRepository["upsert"]>[0]) =>
    Promise.resolve({
    ...input,
    id: "edge-1",
    }),
  );

  return {
    repository: {
      findByPath: () =>
        Promise.resolve(
          existing
            ? {
                ...existing,
                id: "edge-1",
              }
            : null,
        ),
      upsert,
    },
    upsert,
  };
};

describe("toAgentServiceLinkEdge", () => {
  it("converts links into graph-edge records", () => {
    expect(toAgentServiceLinkEdge(baseLink)).toEqual({
      confidenceScore: 600,
      confidenceTier: "medium",
      evidenceCount: 1,
      kind: "agent_to_service",
      sourceNodeId: "agent-1",
      sourceNodeKind: "agent",
      targetNodeId: "service-1",
      targetNodeKind: "service",
    });
  });

  it("rejects missing identifiers", () => {
    expect(() =>
      toAgentServiceLinkEdge({
        ...baseLink,
        agentId: "",
      }),
    ).toThrowError(new AgentServiceLinkPersistenceError("Agent link agentId is required"));
    expect(() =>
      toAgentServiceLinkEdge({
        ...baseLink,
        serviceId: "",
      }),
    ).toThrowError(
      new AgentServiceLinkPersistenceError("Agent link serviceId is required"),
    );
  });
});

describe("persistAgentServiceLink", () => {
  it("creates new link edges", async () => {
    const { repository, upsert } = createRepository();

    await expect(persistAgentServiceLink(baseLink, repository)).resolves.toMatchObject({
      action: "created",
    });
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("returns noop when the stored edge already matches", async () => {
    const { repository, upsert } = createRepository(toAgentServiceLinkEdge(baseLink));

    await expect(persistAgentServiceLink(baseLink, repository)).resolves.toMatchObject({
      action: "noop",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("updates when the stored edge differs", async () => {
    const { repository, upsert } = createRepository({
      ...toAgentServiceLinkEdge(baseLink),
      confidenceScore: 300,
      confidenceTier: "low",
    });

    await expect(
      persistAgentServiceLink(
        {
          ...baseLink,
          confidence: "high",
          confidenceScore: 900,
        },
        repository,
      ),
    ).resolves.toMatchObject({
      action: "updated",
    });
    expect(upsert).toHaveBeenCalledOnce();
  });
});
