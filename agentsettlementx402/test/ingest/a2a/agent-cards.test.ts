import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAgentCardUrl,
  ingestAgentCards,
  toIngestedAgentCardRecord,
  toIngestedAgentIdentity,
  type AgentCardFetcher,
} from "../../../src/ingest/a2a/agent-cards.js";
import * as a2aIngestExports from "../../../src/ingest/a2a/index.js";

describe("buildAgentCardUrl", () => {
  it("normalizes domains and builds the well-known agent-card URL", () => {
    expect(buildAgentCardUrl("example.com")).toBe(
      "https://example.com/.well-known/agent-card.json",
    );
    expect(buildAgentCardUrl(" https://example.com/path/ ")).toBe(
      "https://example.com/.well-known/agent-card.json",
    );
    expect(buildAgentCardUrl("example.com/")).toBe(
      "https://example.com/.well-known/agent-card.json",
    );
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("agent-card projection helpers", () => {
  it("projects normalized agent-card data into persistence-ready records", () => {
    const normalized = {
      agentCardUrl: "https://example.com/.well-known/agent-card.json",
      capabilities: {
        pushNotifications: false,
        stateTransitionHistory: false,
        streaming: true,
      },
      defaultInputModes: [],
      defaultOutputModes: ["application/json"],
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
    } as const;

    expect(toIngestedAgentIdentity(normalized)).toEqual({
      agentCardUrl: "https://example.com/.well-known/agent-card.json",
      displayName: "Agent Example",
      providerOrganization: "Example Org",
      providerUrl: "https://example.com",
    });
    expect(toIngestedAgentCardRecord({ raw: true }, normalized)).toEqual({
      description: "Agent description",
      documentationUrl: "https://example.com/docs",
      normalizedJson: normalized,
      rawJson: { raw: true },
      signatureVerificationStatus: "unverified",
    });
  });
});

describe("ingestAgentCards", () => {
  const fetchedAt = new Date("2026-03-13T20:00:00.000Z");
  const now = () => fetchedAt;

  it("returns validated results for successful agent-card fetches", async () => {
    const fetcher: AgentCardFetcher = {
      fetch: vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({
          name: "Agent Example",
          provider: {
            organization: "Example Org",
            url: "https://example.com",
          },
          url: "https://example.com/.well-known/agent-card.json",
        }),
      }),
    };

    await expect(
      ingestAgentCards(["example.com"], {
        fetcher,
        now,
      }),
    ).resolves.toEqual([
      {
        agent: {
          agentCardUrl: "https://example.com/.well-known/agent-card.json",
          displayName: "Agent Example",
          providerOrganization: "Example Org",
          providerUrl: "https://example.com",
        },
        agentCard: {
          description: null,
          documentationUrl: null,
          normalizedJson: {
            agentCardUrl: "https://example.com/.well-known/agent-card.json",
            capabilities: {
              pushNotifications: false,
              stateTransitionHistory: false,
              streaming: false,
            },
            defaultInputModes: [],
            defaultOutputModes: [],
            description: null,
            documentationUrl: null,
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
          signatureVerificationStatus: "unverified",
        },
        domain: "example.com",
        fetchedAt,
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
        validationStatus: "validated",
      },
    ]);
  });

  it("returns http errors for non-200 responses", async () => {
    const fetcher: AgentCardFetcher = {
      fetch: vi.fn().mockResolvedValue({
        status: 404,
        json: vi.fn(),
      }),
    };

    await expect(
      ingestAgentCards(["missing.example.com"], {
        fetcher,
        now,
      }),
    ).resolves.toEqual([
      {
        agent: null,
        agentCard: null,
        domain: "missing.example.com",
        fetchedAt,
        httpStatus: 404,
        issues: ["HTTP 404"],
        rawJson: null,
        sourceUrl: "https://missing.example.com/.well-known/agent-card.json",
        validationStatus: "http_error",
      },
    ]);
  });

  it("returns invalid_json when json parsing fails", async () => {
    const fetcher: AgentCardFetcher = {
      fetch: vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockRejectedValue(new Error("Unexpected token <")),
      }),
    };

    await expect(
      ingestAgentCards(["bad-json.example.com"], {
        fetcher,
        now,
      }),
    ).resolves.toEqual([
      {
        agent: null,
        agentCard: null,
        domain: "bad-json.example.com",
        fetchedAt,
        httpStatus: 200,
        issues: ["Unexpected token <"],
        rawJson: null,
        sourceUrl: "https://bad-json.example.com/.well-known/agent-card.json",
        validationStatus: "invalid_json",
      },
    ]);
  });

  it("falls back to a generic invalid-json message for non-Error throws", async () => {
    const fetcher: AgentCardFetcher = {
      fetch: vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockRejectedValue("bad-body"),
      }),
    };

    await expect(
      ingestAgentCards(["non-error-json.example.com"], {
        fetcher,
        now,
      }),
    ).resolves.toEqual([
      {
        agent: null,
        agentCard: null,
        domain: "non-error-json.example.com",
        fetchedAt,
        httpStatus: 200,
        issues: ["Invalid JSON response"],
        rawJson: null,
        sourceUrl: "https://non-error-json.example.com/.well-known/agent-card.json",
        validationStatus: "invalid_json",
      },
    ]);
  });

  it("returns schema_error when validated json fails the agent-card schema", async () => {
    const fetcher: AgentCardFetcher = {
      fetch: vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({
          name: "Invalid Agent",
        }),
      }),
    };

    await expect(
      ingestAgentCards(["invalid-schema.example.com"], {
        fetcher,
        now,
      }),
    ).resolves.toEqual([
      {
        agent: null,
        agentCard: null,
        domain: "invalid-schema.example.com",
        fetchedAt,
        httpStatus: 200,
        issues: ["url: Invalid input: expected string, received undefined"],
        rawJson: {
          name: "Invalid Agent",
        },
        sourceUrl: "https://invalid-schema.example.com/.well-known/agent-card.json",
        validationStatus: "schema_error",
      },
    ]);
  });

  it("returns network_error after exhausting retry attempts", async () => {
    const fetcher: AgentCardFetcher = {
      fetch: vi
        .fn()
        .mockRejectedValueOnce(new Error("socket hang up"))
        .mockRejectedValueOnce(new Error("socket hang up")),
    };

    await expect(
      ingestAgentCards(["network.example.com"], {
        fetcher,
        now,
        policy: {
          maxAttempts: 0,
        },
      }),
    ).resolves.toEqual([
      {
        agent: null,
        agentCard: null,
        domain: "network.example.com",
        fetchedAt,
        httpStatus: null,
        issues: ["socket hang up"],
        rawJson: null,
        sourceUrl: "https://network.example.com/.well-known/agent-card.json",
        validationStatus: "network_error",
      },
    ]);
  });

  it("falls back to a generic network message for non-Error throws", async () => {
    const fetcher: AgentCardFetcher = {
      fetch: vi.fn().mockRejectedValue("disconnect"),
    };

    await expect(
      ingestAgentCards(["non-error-network.example.com"], {
        fetcher,
        now,
        policy: {
          maxAttempts: 1,
        },
      }),
    ).resolves.toEqual([
      {
        agent: null,
        agentCard: null,
        domain: "non-error-network.example.com",
        fetchedAt,
        httpStatus: null,
        issues: ["Network request failed"],
        rawJson: null,
        sourceUrl:
          "https://non-error-network.example.com/.well-known/agent-card.json",
        validationStatus: "network_error",
      },
    ]);
  });

  it("retries transient fetch failures when another attempt remains", async () => {
    const fetcher: AgentCardFetcher = {
      fetch: vi
        .fn()
        .mockRejectedValueOnce(new Error("temporary dns failure"))
        .mockResolvedValueOnce({
          status: 200,
          json: vi.fn().mockResolvedValue({
            name: "Recovered Agent",
            url: "https://retry.example.com/.well-known/agent-card.json",
          }),
        }),
    };

    await expect(
      ingestAgentCards(["retry.example.com"], {
        fetcher,
        now,
        policy: {
          maxAttempts: 2,
        },
      }),
    ).resolves.toEqual([
      {
        agent: {
          agentCardUrl: "https://retry.example.com/.well-known/agent-card.json",
          displayName: "Recovered Agent",
          providerOrganization: null,
          providerUrl: null,
        },
        agentCard: {
          description: null,
          documentationUrl: null,
          normalizedJson: {
            agentCardUrl: "https://retry.example.com/.well-known/agent-card.json",
            capabilities: {
              pushNotifications: false,
              stateTransitionHistory: false,
              streaming: false,
            },
            defaultInputModes: [],
            defaultOutputModes: [],
            description: null,
            documentationUrl: null,
            extensions: [],
            name: "Recovered Agent",
            provider: null,
            signatureMetadata: [],
            skills: [],
          },
          rawJson: {
            name: "Recovered Agent",
            url: "https://retry.example.com/.well-known/agent-card.json",
          },
          signatureVerificationStatus: "unverified",
        },
        domain: "retry.example.com",
        fetchedAt,
        httpStatus: 200,
        issues: [],
        rawJson: {
          name: "Recovered Agent",
          url: "https://retry.example.com/.well-known/agent-card.json",
        },
        sourceUrl: "https://retry.example.com/.well-known/agent-card.json",
        validationStatus: "validated",
      },
    ]);
  });

  it("uses the default fetch adapter when no custom fetcher is provided", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fetchedAt);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          name: "Default Fetch Agent",
          url: "https://default-fetch.example.com/.well-known/agent-card.json",
        }),
        status: 200,
      }),
    );

    await expect(
      ingestAgentCards(["default-fetch.example.com"], {
      }),
    ).resolves.toEqual([
      {
        agent: {
          agentCardUrl:
            "https://default-fetch.example.com/.well-known/agent-card.json",
          displayName: "Default Fetch Agent",
          providerOrganization: null,
          providerUrl: null,
        },
        agentCard: {
          description: null,
          documentationUrl: null,
          normalizedJson: {
            agentCardUrl:
              "https://default-fetch.example.com/.well-known/agent-card.json",
            capabilities: {
              pushNotifications: false,
              stateTransitionHistory: false,
              streaming: false,
            },
            defaultInputModes: [],
            defaultOutputModes: [],
            description: null,
            documentationUrl: null,
            extensions: [],
            name: "Default Fetch Agent",
            provider: null,
            signatureMetadata: [],
            skills: [],
          },
          rawJson: {
            name: "Default Fetch Agent",
            url: "https://default-fetch.example.com/.well-known/agent-card.json",
          },
          signatureVerificationStatus: "unverified",
        },
        domain: "default-fetch.example.com",
        fetchedAt,
        httpStatus: 200,
        issues: [],
        rawJson: {
          name: "Default Fetch Agent",
          url: "https://default-fetch.example.com/.well-known/agent-card.json",
        },
        sourceUrl: "https://default-fetch.example.com/.well-known/agent-card.json",
        validationStatus: "validated",
      },
    ]);

    vi.useRealTimers();
  });

  it("re-exports the a2a ingestion surface from its barrel", () => {
    expect(typeof a2aIngestExports.ingestAgentCards).toBe("function");
    expect(typeof a2aIngestExports.buildAgentCardUrl).toBe("function");
    expect(typeof a2aIngestExports.a2aIngestModuleExports.agentCards.ingestAgentCards).toBe(
      "function",
    );
  });
});
