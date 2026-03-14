import { describe, expect, it } from "vitest";

import {
  normalizeA2aAgentCard,
  parseA2aAgentCard,
} from "../../src/core/a2a.js";

describe("parseA2aAgentCard", () => {
  it("parses and normalizes a complete agent card", () => {
    const result = parseA2aAgentCard({
      capabilities: {
        pushNotifications: true,
        stateTransitionHistory: true,
        streaming: true,
      },
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["application/json"],
      description: "Discovery card",
      documentationUrl: "https://example.com/docs",
      extensions: [
        {
          description: "x402 payment support",
          required: true,
          uri: "https://example.com/extensions/x402",
        },
      ],
      name: "Agent Graph",
      provider: {
        organization: "Acme",
        url: "https://example.com",
      },
      signatures: [
        {
          algorithm: "ES256",
          keyId: "kid-1",
          protectedHeader: "header",
          signature: "signature",
        },
      ],
      skills: [
        {
          description: "indexes agent cards",
          id: "discover",
          name: "Discover",
          tags: ["a2a", "graph"],
        },
      ],
      url: "https://example.com/.well-known/agent-card.json",
    });

    expect(result).toEqual({
      success: true,
      data: {
        agentCardUrl: "https://example.com/.well-known/agent-card.json",
        capabilities: {
          pushNotifications: true,
          stateTransitionHistory: true,
          streaming: true,
        },
        defaultInputModes: ["text/plain"],
        defaultOutputModes: ["application/json"],
        description: "Discovery card",
        documentationUrl: "https://example.com/docs",
        extensions: [
          {
            description: "x402 payment support",
            required: true,
            uri: "https://example.com/extensions/x402",
          },
        ],
        name: "Agent Graph",
        provider: {
          organization: "Acme",
          url: "https://example.com",
        },
        signatureMetadata: [
          {
            algorithm: "ES256",
            keyId: "kid-1",
            protectedHeader: "header",
            signature: "signature",
          },
        ],
        skills: [
          {
            description: "indexes agent cards",
            id: "discover",
            name: "Discover",
            tags: ["a2a", "graph"],
          },
        ],
      },
    });
  });

  it("normalizes optional fields into stable null and empty defaults", () => {
    expect(
      normalizeA2aAgentCard({
        name: "Minimal Agent",
        url: "https://example.com/agent-card.json",
      }),
    ).toEqual({
      agentCardUrl: "https://example.com/agent-card.json",
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
      name: "Minimal Agent",
      provider: null,
      signatureMetadata: [],
      skills: [],
    });
  });

  it("normalizes partial nested objects without leaking undefined", () => {
    expect(
      normalizeA2aAgentCard({
        extensions: [
          {
            uri: "https://example.com/extensions/optional",
          },
        ],
        name: "Partial Agent",
        provider: {},
        signatures: [{}],
        skills: [
          {
            id: "audit",
          },
        ],
        url: "https://example.com/partial-agent.json",
      }),
    ).toEqual({
      agentCardUrl: "https://example.com/partial-agent.json",
      capabilities: {
        pushNotifications: false,
        stateTransitionHistory: false,
        streaming: false,
      },
      defaultInputModes: [],
      defaultOutputModes: [],
      description: null,
      documentationUrl: null,
      extensions: [
        {
          description: null,
          required: false,
          uri: "https://example.com/extensions/optional",
        },
      ],
      name: "Partial Agent",
      provider: {
        organization: null,
        url: null,
      },
      signatureMetadata: [
        {
          algorithm: null,
          keyId: null,
          protectedHeader: null,
          signature: null,
        },
      ],
      skills: [
        {
          description: null,
          id: "audit",
          name: null,
          tags: [],
        },
      ],
    });
  });

  it("rejects malformed agent cards", () => {
    expect(
      parseA2aAgentCard({
        name: "",
        url: 123,
      }),
    ).toEqual({
      success: false,
      issues: [
        "name: Too small: expected string to have >=1 characters",
        "url: Invalid input: expected string, received number",
      ],
    });
  });

  it("rejects unexpected fields because the schema is strict", () => {
    expect(
      parseA2aAgentCard({
        name: "Strict Agent",
        unexpected: true,
        url: "https://example.com/strict-agent.json",
      }),
    ).toEqual({
      success: false,
      issues: ["input: Unrecognized key: \"unexpected\""],
    });
  });
});
