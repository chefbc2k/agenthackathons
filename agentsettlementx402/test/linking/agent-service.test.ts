import { describe, expect, it } from "vitest";

import {
  linkAgentsToServices,
  linkConfidenceValues,
  type LinkableAgent,
  type LinkableService,
} from "../../src/linking/agent-service.js";
import * as linkingExports from "../../src/linking/index.js";

const createAgent = (
  overrides: Partial<LinkableAgent> = {},
): LinkableAgent => ({
  agentCardUrl: "https://agent.example.com/.well-known/agent-card.json",
  declaredServiceBindings: [],
  displayName: "Example Agent",
  id: "agent-1",
  providerOrganization: "Example Org",
  providerUrl: "https://agent.example.com",
  signatureVerificationStatus: "unverified",
  ...overrides,
});

const createService = (
  overrides: Partial<LinkableService> = {},
): LinkableService => ({
  id: "service-1",
  network: "eip155:8453",
  payToAddress: "0xabc",
  resourceUrl: "https://agent.example.com/search",
  scheme: "exact",
  ...overrides,
});

describe("linkConfidenceValues", () => {
  it("exposes stable confidence ordering labels", () => {
    expect(linkConfidenceValues).toEqual(["low", "medium", "high"]);
  });
});

describe("linkAgentsToServices", () => {
  it.each([
    {
      expectedConfidence: "high",
      name: "creates a high-confidence link for an explicit declaration with verified signature",
      services: [createService()],
      agents: [
        createAgent({
          declaredServiceBindings: [
            {
              network: "eip155:8453",
              payToAddress: "0xabc",
              proofOfOwnership: false,
              resourceUrl: "https://agent.example.com/search",
              scheme: "exact",
              source: "agent_card_extension",
            },
          ],
          signatureVerificationStatus: "verified",
        }),
      ],
    },
    {
      expectedConfidence: "high",
      name: "creates a high-confidence link for an explicit declaration with proof of ownership",
      services: [createService()],
      agents: [
        createAgent({
          declaredServiceBindings: [
            {
              network: null,
              payToAddress: "0xabc",
              proofOfOwnership: true,
              resourceUrl: null,
              scheme: null,
              source: "agent_card_extension",
            },
          ],
        }),
      ],
    },
    {
      expectedConfidence: "medium",
      name: "creates a medium-confidence link for a domain match with consistent payTo usage",
      services: [
        createService({
          id: "service-1",
          resourceUrl: "https://agent.example.com/search",
        }),
        createService({
          id: "service-2",
          resourceUrl: "https://agent.example.com/respond",
        }),
      ],
      agents: [createAgent()],
    },
  ])("$name", ({ agents, expectedConfidence, services }) => {
    const links = linkAgentsToServices(agents, services);

    expect(links).toHaveLength(services.length === 1 ? 1 : 2);
    expect(links[0]?.confidence).toBe(expectedConfidence);
    expect(links[0]?.confidenceScore).toBe(
      expectedConfidence === "high" ? 900 : 600,
    );
    expect(links[0]?.evidence[0]?.summary.length).toBeGreaterThan(0);
  });

  it.each([
    {
      declaration: {
        network: null,
        payToAddress: "0xabc",
        proofOfOwnership: true,
        resourceUrl: "https://different.example.com/search",
        scheme: null,
        source: "agent_card_extension",
      },
      name: "resource URL does not match",
    },
    {
      declaration: {
        network: "eip155:1",
        payToAddress: "0xabc",
        proofOfOwnership: true,
        resourceUrl: null,
        scheme: null,
        source: "agent_card_extension",
      },
      name: "network does not match",
    },
    {
      declaration: {
        network: null,
        payToAddress: "0xabc",
        proofOfOwnership: true,
        resourceUrl: null,
        scheme: "subscription",
        source: "agent_card_extension",
      },
      name: "scheme does not match",
    },
    {
      declaration: {
        network: null,
        payToAddress: "0xdef",
        proofOfOwnership: true,
        resourceUrl: null,
        scheme: null,
        source: "agent_card_extension",
      },
      name: "payTo does not match",
    },
    {
      declaration: {
        network: null,
        payToAddress: null,
        proofOfOwnership: true,
        resourceUrl: null,
        scheme: null,
        source: "agent_card_extension",
      },
      name: "no resource or wallet is declared",
    },
  ])("does not create an explicit link when $name", ({ declaration }) => {
    const links = linkAgentsToServices(
      [
        createAgent({
          declaredServiceBindings: [declaration],
          providerUrl: null,
        }),
      ],
      [
        createService({
          resourceUrl: "https://off-domain.example.com/search",
        }),
      ],
    );

    expect(links).toEqual([]);
  });

  it("does not create a medium-confidence link when payTo usage is inconsistent for the hostname", () => {
    const links = linkAgentsToServices(
      [createAgent()],
      [
        createService({
          id: "service-1",
          payToAddress: "0xabc",
          resourceUrl: "https://agent.example.com/search",
        }),
        createService({
          id: "service-2",
          payToAddress: "0xdef",
          resourceUrl: "https://agent.example.com/respond",
        }),
      ],
    );

    expect(links).toEqual([]);
  });

  it("uses the higher-confidence explicit rule when explicit and domain evidence both apply", () => {
    const links = linkAgentsToServices(
      [
        createAgent({
          declaredServiceBindings: [
            {
              network: "eip155:8453",
              payToAddress: "0xabc",
              proofOfOwnership: true,
              resourceUrl: "https://agent.example.com/search",
              scheme: "exact",
              source: "agent_card_extension",
            },
          ],
          signatureVerificationStatus: "verified",
        }),
      ],
      [createService()],
    );

    expect(links).toEqual([
      {
        agentId: "agent-1",
        confidence: "high",
        confidenceScore: 900,
        evidence: [
          {
            declarationSource: "agent_card_extension",
            matchedAgentHostname: "agent.example.com",
            matchedPayToAddress: "0xabc",
            matchedResourceHostname: "agent.example.com",
            proofOfOwnership: true,
            rule: "explicit_declaration",
            signatureVerified: true,
            summary:
              "Agent explicitly declares the service or wallet and includes a verified signature or ownership proof.",
          },
          {
            declarationSource: null,
            matchedAgentHostname: "agent.example.com",
            matchedPayToAddress: "0xabc",
            matchedResourceHostname: "agent.example.com",
            proofOfOwnership: false,
            rule: "domain_match",
            signatureVerified: true,
            summary:
              "Service hostname matches the agent domain and all services on that hostname use a consistent payTo address.",
          },
        ],
        serviceId: "service-1",
      },
    ]);
  });

  it("keeps heuristic linking disabled by default", () => {
    const links = linkAgentsToServices(
      [
        createAgent({
          agentCardUrl: "https://mesh.alpha.example/.well-known/agent-card.json",
          providerUrl: null,
        }),
      ],
      [
        createService({
          resourceUrl: "https://alpha.payments.net/search",
        }),
      ],
    );

    expect(links).toEqual([]);
  });

  it("does not create a medium-confidence link when the service URL is invalid", () => {
    const links = linkAgentsToServices(
      [createAgent()],
      [
        createService({
          resourceUrl: "not-a-url",
        }),
      ],
    );

    expect(links).toEqual([]);
  });

  it("does not create a medium-confidence link when the service hostname differs from the agent domain", () => {
    const links = linkAgentsToServices(
      [createAgent()],
      [
        createService({
          resourceUrl: "https://other.example.com/search",
        }),
      ],
    );

    expect(links).toEqual([]);
  });

  it("can enable the low-confidence heuristic explicitly", () => {
    const links = linkAgentsToServices(
      [
        createAgent({
          agentCardUrl: "https://mesh.alpha.example/.well-known/agent-card.json",
          providerUrl: null,
        }),
      ],
      [
        createService({
          resourceUrl: "https://alpha.payments.net/search",
        }),
      ],
      {
        enableHeuristicLinking: true,
      },
    );

    expect(links).toEqual([
      {
        agentId: "agent-1",
        confidence: "low",
        confidenceScore: 300,
        evidence: [
          {
            declarationSource: null,
            matchedAgentHostname: "mesh.alpha.example",
            matchedPayToAddress: "0xabc",
            matchedResourceHostname: "alpha.payments.net",
            proofOfOwnership: false,
            rule: "heuristic_hostname_label",
            signatureVerified: false,
            summary:
              "Agent and service hostnames share a hostname label, which is a weak heuristic and disabled by default.",
          },
        ],
        serviceId: "service-1",
      },
    ]);
  });

  it("does not create a low-confidence heuristic link when hostname labels do not overlap", () => {
    const links = linkAgentsToServices(
      [
        createAgent({
          agentCardUrl: "https://mesh.alpha.example/.well-known/agent-card.json",
          providerUrl: null,
        }),
      ],
      [
        createService({
          resourceUrl: "https://payments.beta.net/search",
        }),
      ],
      {
        enableHeuristicLinking: true,
      },
    );

    expect(links).toEqual([]);
  });

  it("does not create a heuristic link when the service URL cannot be parsed", () => {
    const links = linkAgentsToServices(
      [createAgent()],
      [
        createService({
          resourceUrl: "not-a-url",
        }),
      ],
      {
        enableHeuristicLinking: true,
      },
    );

    expect(links).toEqual([]);
  });

  it("ignores explicit declarations that lack proof and signature verification", () => {
    const links = linkAgentsToServices(
      [
        createAgent({
          declaredServiceBindings: [
            {
              network: "eip155:8453",
              payToAddress: "0xabc",
              proofOfOwnership: false,
              resourceUrl: "https://off-domain.example.com/search",
              scheme: "exact",
              source: "agent_card_extension",
            },
          ],
          providerUrl: null,
        }),
      ],
      [
        createService({
          resourceUrl: "https://off-domain.example.com/search",
        }),
      ],
    );

    expect(links).toEqual([]);
  });

  it("sorts links deterministically by agent and service ids", () => {
    const links = linkAgentsToServices(
      [
        createAgent({
          id: "agent-2",
          declaredServiceBindings: [
            {
              network: null,
              payToAddress: "0xabc",
              proofOfOwnership: true,
              resourceUrl: null,
              scheme: null,
              source: "extension",
            },
          ],
        }),
        createAgent({
          id: "agent-1",
          declaredServiceBindings: [
            {
              network: null,
              payToAddress: "0xabc",
              proofOfOwnership: true,
              resourceUrl: null,
              scheme: null,
              source: "extension",
            },
          ],
        }),
      ],
      [
        createService({ id: "service-2" }),
        createService({ id: "service-1" }),
      ],
    );

    expect(
      links.map((link) => `${link.agentId}:${link.serviceId}`),
    ).toEqual([
      "agent-1:service-1",
      "agent-1:service-2",
      "agent-2:service-1",
      "agent-2:service-2",
    ]);
  });

  it("tolerates invalid provider URLs by falling back to the agent-card domain", () => {
    const links = linkAgentsToServices(
      [
        createAgent({
          providerUrl: "not-a-url",
        }),
      ],
      [createService()],
    );

    expect(links).toHaveLength(1);
    expect(links[0]?.confidence).toBe("medium");
  });
});

describe("linking barrel exports", () => {
  it("re-exports the linker module", () => {
    expect(typeof linkingExports.linkAgentsToServices).toBe("function");
    expect(
      typeof linkingExports.linkingModuleExports.agentService.linkAgentsToServices,
    ).toBe("function");
  });
});
