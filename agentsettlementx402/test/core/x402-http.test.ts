import { describe, expect, it } from "vitest";

import {
  normalizeX402PaymentAttemptTranscript,
  parseX402PaymentRequiredBody,
  parseX402SettlementResponse,
  parseX402SettlementResponseHeader,
} from "../../src/core/x402-http.js";

describe("parseX402PaymentRequiredBody", () => {
  it("parses the minimal PaymentRequired body subset", () => {
    expect(
      parseX402PaymentRequiredBody({
        accepts: [
          {
            amount: "1000",
            asset: "USDC",
            network: "eip155:8453",
            payTo: "0xpayto",
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
              description: null,
              mimeType: null,
              outputSchemaUrl: null,
              resourceUrl: null,
            },
            network: "eip155:8453",
            payTo: "0xpayto",
            scheme: "exact",
          },
        ],
      },
    });
  });

  it("rejects malformed PaymentRequired bodies", () => {
    expect(
      parseX402PaymentRequiredBody({
        accepts: [
          {
            amount: "1000",
            asset: "USDC",
            network: 8453,
            payTo: "0xpayto",
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

describe("parseX402SettlementResponse and parseX402SettlementResponseHeader", () => {
  it("parses a successful settlement response", () => {
    expect(
      parseX402SettlementResponse({
        network: "eip155:8453",
        payTo: "0xpayto",
        payer: "0xpayer",
        success: true,
        transaction: "0xtxhash",
      }),
    ).toEqual({
      success: true,
      data: {
        errorReason: null,
        network: "eip155:8453",
        payTo: "0xpayto",
        payer: "0xpayer",
        success: true,
        txHash: "0xtxhash",
      },
    });
  });

  it("parses a failed settlement response with an error reason", () => {
    expect(
      parseX402SettlementResponse({
        errorReason: "settlement_failed",
        network: "eip155:8453",
        payer: "0xpayer",
        success: false,
      }),
    ).toEqual({
      success: true,
      data: {
        errorReason: "settlement_failed",
        network: "eip155:8453",
        payTo: null,
        payer: "0xpayer",
        success: false,
        txHash: null,
      },
    });
  });

  it("reads the standard payment-response header case-insensitively", () => {
    expect(
      parseX402SettlementResponseHeader({
        "PAYMENT-RESPONSE":
          '{"success":true,"network":"eip155:8453","payer":"0xpayer","transaction":"0xtxhash"}',
      }),
    ).toEqual({
      success: true,
      data: {
        errorReason: null,
        network: "eip155:8453",
        payTo: null,
        payer: "0xpayer",
        success: true,
        txHash: "0xtxhash",
      },
    });
  });

  it("falls back to the legacy x-payment-response header", () => {
    expect(
      parseX402SettlementResponseHeader({
        "X-PAYMENT-RESPONSE":
          '{"success":false,"network":"eip155:8453","errorReason":"expired_payment"}',
      }),
    ).toEqual({
      success: true,
      data: {
        errorReason: "expired_payment",
        network: "eip155:8453",
        payTo: null,
        payer: null,
        success: false,
        txHash: null,
      },
    });
  });

  it("rejects missing and malformed settlement headers", () => {
    expect(parseX402SettlementResponseHeader({})).toEqual({
      success: false,
      issues: ["payment-response header: Missing payment response header"],
    });
    expect(
      parseX402SettlementResponseHeader({
        "payment-response": "{bad-json}",
      }),
    ).toEqual({
      success: false,
      issues: ["payment-response header: Invalid JSON response"],
    });
  });
});

describe("normalizeX402PaymentAttemptTranscript", () => {
  it("normalizes a successful transcript and fills payTo/network from PaymentRequired when needed", () => {
    expect(
      normalizeX402PaymentAttemptTranscript({
        body: {
          accepts: [
            {
              amount: "1000",
              asset: "USDC",
              network: "eip155:8453",
              payTo: "0xpayto",
              scheme: "exact",
            },
          ],
        },
        headers: {
          "payment-response":
            '{"success":true,"payer":"0xpayer","transaction":"0xtxhash"}',
        },
      }),
    ).toEqual({
      success: true,
      data: {
        errorReason: null,
        network: "eip155:8453",
        payTo: "0xpayto",
        payer: "0xpayer",
        success: true,
        txHash: "0xtxhash",
      },
    });
  });

  it("normalizes a failed settlement transcript directly from the header", () => {
    expect(
      normalizeX402PaymentAttemptTranscript({
        headers: {
          "payment-response":
            '{"success":false,"network":"eip155:8453","payer":"0xpayer","errorReason":"settlement_failed"}',
        },
      }),
    ).toEqual({
      success: true,
      data: {
        errorReason: "settlement_failed",
        network: "eip155:8453",
        payTo: null,
        payer: "0xpayer",
        success: false,
        txHash: null,
      },
    });
  });

  it("prefers settlement header network and payTo over the payment-required fallback", () => {
    expect(
      normalizeX402PaymentAttemptTranscript({
        body: {
          accepts: [
            {
              amount: "1000",
              asset: "USDC",
              network: "eip155:1",
              payTo: "0xbodypayto",
              scheme: "exact",
            },
          ],
        },
        headers: {
          "payment-response":
            '{"success":true,"network":"eip155:8453","payTo":"0xheaderpayto","payer":"0xpayer","transaction":"0xtxhash"}',
        },
      }),
    ).toEqual({
      success: true,
      data: {
        errorReason: null,
        network: "eip155:8453",
        payTo: "0xheaderpayto",
        payer: "0xpayer",
        success: true,
        txHash: "0xtxhash",
      },
    });
  });

  it("normalizes a settlement transcript when only the settlement header is present", () => {
    expect(
      normalizeX402PaymentAttemptTranscript({
        headers: {
          "payment-response":
            '{"success":true,"network":"eip155:8453","payTo":"0xpayto","payer":"0xpayer","transaction":"0xtxhash"}',
        },
      }),
    ).toEqual({
      success: true,
      data: {
        errorReason: null,
        network: "eip155:8453",
        payTo: "0xpayto",
        payer: "0xpayer",
        success: true,
        txHash: "0xtxhash",
      },
    });
  });

  it("normalizes a settlement transcript with no network fallback data to null", () => {
    expect(
      normalizeX402PaymentAttemptTranscript({
        headers: {
          "payment-response":
            '{"success":true,"payer":"0xpayer","transaction":"0xtxhash"}',
        },
      }),
    ).toEqual({
      success: true,
      data: {
        errorReason: null,
        network: null,
        payTo: null,
        payer: "0xpayer",
        success: true,
        txHash: "0xtxhash",
      },
    });
  });

  it("normalizes a pre-settlement 402 transcript into an unsuccessful payment attempt", () => {
    expect(
      normalizeX402PaymentAttemptTranscript({
        body: {
          accepts: [
            {
              amount: "1000",
              asset: "USDC",
              network: "eip155:8453",
              payTo: "0xpayto",
              scheme: "exact",
            },
          ],
        },
        headers: {},
      }),
    ).toEqual({
      success: true,
      data: {
        errorReason: null,
        network: "eip155:8453",
        payTo: "0xpayto",
        payer: null,
        success: false,
        txHash: null,
      },
    });
  });

  it("returns a parse failure when neither settlement nor payment-required data can be parsed", () => {
    expect(
      normalizeX402PaymentAttemptTranscript({
        body: {
          accepts: [
            {
              amount: "1000",
              asset: "USDC",
              network: 8453,
              payTo: "0xpayto",
              scheme: "exact",
            },
          ],
        },
        headers: {},
      }),
    ).toEqual({
      success: false,
      issues: ["payment-response header: Missing payment response header"],
    });
  });

  it("returns a parse failure when both the settlement header and body are absent", () => {
    expect(
      normalizeX402PaymentAttemptTranscript({
        headers: {},
      }),
    ).toEqual({
      success: false,
      issues: ["payment-response header: Missing payment response header"],
    });
  });
});
