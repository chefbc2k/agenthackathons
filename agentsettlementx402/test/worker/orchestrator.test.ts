import { describe, expect, it, vi } from "vitest";

import {
  createEmptyWorkerDependencies,
  runWorkerJob,
} from "../../src/worker/orchestrator.js";

describe("runWorkerJob", () => {
  it("runs all configured stages deterministically", async () => {
    const dependencies = createEmptyWorkerDependencies();
    const listMetricInputs = vi.fn(() => Promise.resolve([
      {
        agentId: "agent:https://example.com/.well-known/agent-card.json",
        evidenceTypes: ["bazaar_declaration"] as const,
        observations: [
          {
            groupKey: "payment-1",
            occurredAt: new Date("2026-03-12T00:00:00.000Z"),
            outcome: "success" as const,
            payerId: "payer-1",
          },
        ],
        serviceId: "service:https://example.com/service",
      },
    ]));

    const result = await runWorkerJob(
      {
        agentDomains: ["example.com"],
        facilitatorBaseUrl: "https://facilitator.example.com",
        kind: "sync_all",
      },
      {
        ...dependencies,
        a2aIngestionOptions: {
          fetcher: {
            fetch: () =>
              Promise.resolve({
                json: () =>
                  Promise.resolve({
                    name: "Example Agent",
                    url: "https://example.com/.well-known/agent-card.json",
                  }),
                status: 200,
              }),
          },
          now: () => new Date("2026-03-13T00:00:00.000Z"),
        },
        bazaarIngestionOptions: {
          fetcher: {
            fetch: () =>
              Promise.resolve({
                json: () =>
                  Promise.resolve([
                    {
                      network: "eip155:8453",
                      payTo: "wallet:https://example.com/service",
                      resource: "https://example.com/service",
                      scheme: "exact",
                    },
                  ]),
                status: 200,
              }),
          },
        },
        listMetricInputs,
      },
    );

    expect(result.completedAt.toISOString()).toBe("2026-03-13T00:00:00.000Z");
    expect(result.stages.a2a).toMatchObject({
      created: 1,
      processed: 1,
      skipped: false,
    });
    expect(result.stages.bazaar).toMatchObject({
      created: 1,
      processed: 1,
      skipped: false,
    });
    expect(result.stages.linking).toMatchObject({
      created: 1,
      processed: 1,
      skipped: false,
    });
    expect(result.stages.metrics).toMatchObject({
      created: 1,
      processed: 1,
      skipped: false,
    });
    expect(result.stages.metrics.scores).toHaveLength(1);
    expect(listMetricInputs).toHaveBeenCalledOnce();
  });

  it("skips stages that are not requested or not configured", async () => {
    await expect(
      runWorkerJob(
        {
          kind: "sync_all",
          stages: ["metrics"],
        },
        createEmptyWorkerDependencies(),
      ),
    ).resolves.toEqual({
      completedAt: new Date("2026-03-13T00:00:00.000Z"),
      jobKey: null,
      stages: {
        a2a: { created: 0, noop: 0, processed: 0, skipped: true, updated: 0 },
        bazaar: { created: 0, noop: 0, processed: 0, skipped: true, updated: 0 },
        linking: { created: 0, noop: 0, processed: 0, skipped: true, updated: 0 },
        metrics: {
          created: 0,
          noop: 0,
          processed: 0,
          scores: [],
          skipped: false,
          updated: 0,
        },
      },
    });
  });

  it("falls back to the system clock when no custom now function exists", async () => {
    const dependencies = createEmptyWorkerDependencies();
    const { now: _now, ...dependenciesWithoutNow } = dependencies;

    const result = await runWorkerJob(
      {
        kind: "sync_all",
      },
      dependenciesWithoutNow,
    );

    expect(result.completedAt).toBeInstanceOf(Date);
  });

  it("skips the metrics stage when it is not requested", async () => {
    await expect(
      runWorkerJob(
        {
          kind: "sync_all",
          stages: ["a2a"],
        },
        createEmptyWorkerDependencies(),
      ),
    ).resolves.toMatchObject({
      stages: {
        metrics: {
          skipped: true,
        },
      },
    });
  });

  it("returns noop actions on deterministic reruns with the same dependencies", async () => {
    const dependencies = createEmptyWorkerDependencies();
    const metricInput = {
      agentId: "agent:https://example.com/.well-known/agent-card.json",
      evidenceTypes: ["bazaar_declaration"] as const,
      observations: [],
      serviceId: "service:https://example.com/service",
    };

    const configuredDependencies = {
      ...dependencies,
      a2aIngestionOptions: {
        fetcher: {
          fetch: () =>
            Promise.resolve({
              json: () =>
                Promise.resolve({
                  name: "Example Agent",
                  url: "https://example.com/.well-known/agent-card.json",
                }),
              status: 200,
            }),
        },
        now: () => new Date("2026-03-13T00:00:00.000Z"),
      },
      bazaarIngestionOptions: {
        fetcher: {
          fetch: () =>
            Promise.resolve({
              json: () =>
                Promise.resolve([
                  {
                    network: "eip155:8453",
                    payTo: "wallet:https://example.com/service",
                    resource: "https://example.com/service",
                    scheme: "exact",
                  },
                ]),
              status: 200,
            }),
        },
      },
      listMetricInputs: () => Promise.resolve([metricInput]),
    };

    await runWorkerJob(
      {
        agentDomains: ["example.com"],
        facilitatorBaseUrl: "https://facilitator.example.com",
        kind: "sync_all",
      },
      configuredDependencies,
    );

    await expect(
      runWorkerJob(
        {
          agentDomains: ["example.com"],
          facilitatorBaseUrl: "https://facilitator.example.com",
          kind: "sync_all",
        },
        configuredDependencies,
      ),
    ).resolves.toMatchObject({
      stages: {
        a2a: {
          noop: 1,
        },
        bazaar: {
          noop: 1,
        },
        linking: {
          noop: 1,
        },
        metrics: {
          noop: 1,
        },
      },
    });
  });
});

describe("createEmptyWorkerDependencies", () => {
  it("provides deterministic in-memory repositories and loaders", async () => {
    const dependencies = createEmptyWorkerDependencies();

    await expect(
      dependencies.a2aRepositories.agents.create({
        agentCardUrl: "https://example.com/.well-known/agent-card.json",
        displayName: "Example",
        providerOrganization: null,
        providerUrl: null,
      }),
    ).resolves.toMatchObject({
      id: "agent:https://example.com/.well-known/agent-card.json",
    });
    await expect(
      dependencies.a2aRepositories.agents.findByAgentCardUrl("missing"),
    ).resolves.toBeNull();
    const agent = await dependencies.a2aRepositories.agents.upsert({
      agentCardUrl: "https://example.com/.well-known/agent-card.json",
      displayName: "Example",
      providerOrganization: null,
      providerUrl: null,
    });
    await expect(
      dependencies.a2aRepositories.agentCards.findByAgentId(agent.id),
    ).resolves.toBeNull();
    await expect(
      dependencies.a2aRepositories.agentCards.upsert({
        agentId: agent.id,
        description: null,
        documentationUrl: null,
        normalizedJson: {},
        rawJson: {},
        rawJsonHash: "hash",
        signatureVerificationStatus: "verified",
      }),
    ).resolves.toMatchObject({
      id: `agent-card:${agent.id}`,
    });
    await expect(
      dependencies.bazaarRepositories.services.findByResourceUrl("missing"),
    ).resolves.toBeNull();
    await expect(
      dependencies.bazaarRepositories.services.findByLocator({
        network: "eip155:8453",
        resourceUrl: "missing",
        scheme: "exact",
      }),
    ).resolves.toBeNull();
    await expect(
      dependencies.bazaarRepositories.services.upsert({
        amount: null,
        asset: null,
        description: null,
        inputSchemaUrl: null,
        mimeType: null,
        network: "eip155:8453",
        outputSchemaUrl: null,
        payToWalletId: "wallet:https://example.com/service",
        rawSourceJson: {},
        resourceUrl: "https://example.com/service",
        schemaId: null,
        scheme: "exact",
        sourceFingerprint: "fp",
      }),
    ).resolves.toMatchObject({
      id: "service:https://example.com/service",
    });
    await expect(
      dependencies.bazaarRepositories.services.findByResourceUrl(
        "https://example.com/service",
      ),
    ).resolves.toMatchObject({
      id: "service:https://example.com/service",
    });
    await expect(
      dependencies.bazaarRepositories.wallets.findByAddressAndNetwork(
        "0xabc",
        "eip155:8453",
      ),
    ).resolves.toMatchObject({
      id: "wallet:eip155:8453:0xabc",
    });
    await expect(
      dependencies.bazaarRepositories.wallets.upsert({
        address: "0xabc",
        network: "eip155:8453",
      }),
    ).resolves.toMatchObject({
      id: "wallet:eip155:8453:0xabc",
    });
    await expect(
      dependencies.bazaarRepositories.linkEdges.findByPath({
        kind: "agent_to_service",
        sourceNodeId: "agent-1",
        sourceNodeKind: "agent",
        targetNodeId: "service-1",
        targetNodeKind: "service",
      }),
    ).resolves.toBeNull();
    await expect(
      dependencies.metricsRepository.findByAgentAndService("agent-1", "service-1"),
    ).resolves.toBeNull();
    await expect(
      dependencies.listLinkableState(),
    ).resolves.toMatchObject({
      agents: [
        {
          id: "agent:https://example.com/.well-known/agent-card.json",
        },
      ],
      services: [
        {
          id: "service:https://example.com/service",
        },
      ],
    });
    expect(dependencies.now?.()).toEqual(new Date("2026-03-13T00:00:00.000Z"));
  });
});
