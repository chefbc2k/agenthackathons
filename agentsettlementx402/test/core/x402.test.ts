import { describe, expect, it } from "vitest";

import {
  normalizeA2aX402ReceiptEnvelope,
  normalizeX402BazaarResource,
  parseA2aX402ReceiptEnvelope,
  parseX402BazaarResource,
  parseX402BazaarResourceList,
  parseX402PaymentRequired,
} from "../../src/core/x402.js";

describe("parseX402PaymentRequired", () => {
  it("parses the minimal payment requirement set", () => {
    expect(
      parseX402PaymentRequired({
        accepts: [
          {
            amount: "1000",
            asset: "USDC",
            metadata: {
              description: "pay for discovery",
              mimeType: "application/json",
              outputSchema: "https://example.com/schema/output.json",
              resource: "https://example.com/resource",
            },
            network: "eip155:84532",
            payTo: "0xabc",
            scheme: "exact",
          },
        ],
      }),
    ).toEqual({
      success: true,
      data: {
        acceptedPayments: [
          {
            amount: "1000",
            asset: "USDC",
            metadata: {
              description: "pay for discovery",
              mimeType: "application/json",
              outputSchemaUrl: "https://example.com/schema/output.json",
              resourceUrl: "https://example.com/resource",
            },
            network: "eip155:84532",
            payTo: "0xabc",
            scheme: "exact",
          },
        ],
      },
    });
  });

  it("normalizes absent metadata into null fields", () => {
    expect(
      parseX402PaymentRequired({
        accepts: [
          {
            amount: "1",
            asset: "USDC",
            network: "eip155:84532",
            payTo: "0xdef",
            scheme: "exact",
          },
        ],
      }),
    ).toEqual({
      success: true,
      data: {
        acceptedPayments: [
          {
            amount: "1",
            asset: "USDC",
            metadata: {
              description: null,
              mimeType: null,
              outputSchemaUrl: null,
              resourceUrl: null,
            },
            network: "eip155:84532",
            payTo: "0xdef",
            scheme: "exact",
          },
        ],
      },
    });
  });

  it("rejects malformed payment requirements", () => {
    expect(
      parseX402PaymentRequired({
        accepts: [
          {
            amount: "10",
            asset: "USDC",
            network: 84532,
            payTo: "0xabc",
            scheme: "exact",
          },
        ],
      }),
    ).toEqual({
      success: false,
      issues: ["accepts.0.network: Invalid input: expected string, received number"],
    });
  });
});

describe("parseX402BazaarResource and parseX402BazaarResourceList", () => {
  it("parses a bazaar resource with schema metadata", () => {
    expect(
      parseX402BazaarResource({
        amount: "25",
        asset: "USDC",
        network: "eip155:84532",
        payTo: "0x123",
        resource: "https://example.com/resource/graph",
        schema: {
          id: "graph.v1",
          input: "https://example.com/schema/input.json",
          output: "https://example.com/schema/output.json",
        },
        scheme: "exact",
      }),
    ).toEqual({
      success: true,
      data: {
        amount: "25",
        asset: "USDC",
        network: "eip155:84532",
        payTo: "0x123",
        resourceUrl: "https://example.com/resource/graph",
        schemaMetadata: {
          inputSchemaUrl: "https://example.com/schema/input.json",
          outputSchemaUrl: "https://example.com/schema/output.json",
          schemaId: "graph.v1",
        },
        scheme: "exact",
      },
    });
  });

  it("normalizes partial schema metadata into null fields", () => {
    expect(
      normalizeX402BazaarResource({
        network: "eip155:84532",
        payTo: "0x123",
        resource: "https://example.com/resource/partial-schema",
        schema: {
          input: "https://example.com/schema/input.json",
        },
        scheme: "exact",
      }),
    ).toEqual({
      amount: null,
      asset: null,
      network: "eip155:84532",
      payTo: "0x123",
      resourceUrl: "https://example.com/resource/partial-schema",
      schemaMetadata: {
        inputSchemaUrl: "https://example.com/schema/input.json",
        outputSchemaUrl: null,
        schemaId: null,
      },
      scheme: "exact",
    });
  });

  it("normalizes schema metadata when the input schema URL is absent", () => {
    expect(
      normalizeX402BazaarResource({
        network: "eip155:84532",
        payTo: "0x123",
        resource: "https://example.com/resource/output-only",
        schema: {
          output: "https://example.com/schema/output.json",
        },
        scheme: "exact",
      }),
    ).toEqual({
      amount: null,
      asset: null,
      network: "eip155:84532",
      payTo: "0x123",
      resourceUrl: "https://example.com/resource/output-only",
      schemaMetadata: {
        inputSchemaUrl: null,
        outputSchemaUrl: "https://example.com/schema/output.json",
        schemaId: null,
      },
      scheme: "exact",
    });
  });

  it("normalizes missing optional bazaar metadata", () => {
    expect(
      normalizeX402BazaarResource({
        network: "eip155:84532",
        payTo: "0x456",
        resource: "https://example.com/resource/minimal",
        scheme: "exact",
      }),
    ).toEqual({
      amount: null,
      asset: null,
      network: "eip155:84532",
      payTo: "0x456",
      resourceUrl: "https://example.com/resource/minimal",
      schemaMetadata: null,
      scheme: "exact",
    });
  });

  it("parses a bazaar resource list", () => {
    expect(
      parseX402BazaarResourceList([
        {
          network: "eip155:84532",
          payTo: "0xaaa",
          resource: "https://example.com/a",
          scheme: "exact",
        },
        {
          network: "eip155:84532",
          payTo: "0xbbb",
          resource: "https://example.com/b",
          scheme: "subscription",
        },
      ]),
    ).toEqual({
      success: true,
      data: [
        {
          amount: null,
          asset: null,
          network: "eip155:84532",
          payTo: "0xaaa",
          resourceUrl: "https://example.com/a",
          schemaMetadata: null,
          scheme: "exact",
        },
        {
          amount: null,
          asset: null,
          network: "eip155:84532",
          payTo: "0xbbb",
          resourceUrl: "https://example.com/b",
          schemaMetadata: null,
          scheme: "subscription",
        },
      ],
    });
  });

  it("rejects malformed bazaar resources", () => {
    expect(
      parseX402BazaarResource({
        network: "eip155:84532",
        payTo: "0x789",
        resource: "not-a-url",
        scheme: "exact",
      }),
    ).toEqual({
      success: false,
      issues: ["resource: Invalid URL"],
    });
  });
});

describe("parseA2aX402ReceiptEnvelope", () => {
  it("parses a receipt envelope with nested receipts and errors", () => {
    expect(
      parseA2aX402ReceiptEnvelope({
        error: {
          code: "SETTLEMENT_FAILED",
          message: "upstream facilitator rejected the payment",
        },
        receipts: [
          {
            error: {
              code: "INVALID_SIGNATURE",
              message: "signature did not verify",
            },
            network: "eip155:84532",
            payTo: "0xabc",
            payer: "0xdef",
            receiptId: "receipt-1",
            scheme: "exact",
            status: "failed",
            transactionHash: "0xtx",
          },
        ],
        status: "failed",
      }),
    ).toEqual({
      success: true,
      data: {
        error: {
          code: "SETTLEMENT_FAILED",
          message: "upstream facilitator rejected the payment",
        },
        receipts: [
          {
            error: {
              code: "INVALID_SIGNATURE",
              message: "signature did not verify",
            },
            network: "eip155:84532",
            payTo: "0xabc",
            payer: "0xdef",
            receiptId: "receipt-1",
            scheme: "exact",
            status: "failed",
            transactionHash: "0xtx",
          },
        ],
        status: "failed",
      },
    });
  });

  it("normalizes optional receipt fields into null and empty defaults", () => {
    expect(
      normalizeA2aX402ReceiptEnvelope({
        status: "pending",
      }),
    ).toEqual({
      error: null,
      receipts: [],
      status: "pending",
    });
  });

  it("normalizes partial receipt entries into stable null fields", () => {
    expect(
      normalizeA2aX402ReceiptEnvelope({
        receipts: [
          {
            network: "eip155:84532",
            scheme: "exact",
            status: "settled",
          },
        ],
        status: "settled",
      }),
    ).toEqual({
      error: null,
      receipts: [
        {
          error: null,
          network: "eip155:84532",
          payTo: null,
          payer: null,
          receiptId: null,
          scheme: "exact",
          status: "settled",
          transactionHash: null,
        },
      ],
      status: "settled",
    });
  });

  it("rejects malformed receipt envelopes", () => {
    expect(
      parseA2aX402ReceiptEnvelope({
        receipts: [],
        status: "unknown",
      }),
    ).toEqual({
      success: false,
      issues: [
        "status: Invalid option: expected one of \"required\"|\"pending\"|\"settled\"|\"failed\"",
      ],
    });
  });
});
