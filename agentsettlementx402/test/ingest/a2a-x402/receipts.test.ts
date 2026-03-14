import { describe, expect, it } from "vitest";

import {
  a2aX402KnownErrorCodes,
  appendA2aX402ReceiptEnvelope,
  isKnownA2aX402ErrorCode,
  parseA2aX402TaskPaymentMetadata,
  toA2aX402PaymentAttempts,
} from "../../../src/ingest/a2a-x402/receipts.js";
import * as a2aX402IngestExports from "../../../src/ingest/a2a-x402/index.js";

describe("a2aX402KnownErrorCodes and isKnownA2aX402ErrorCode", () => {
  it("exposes stable known error codes and recognizes them", () => {
    expect(a2aX402KnownErrorCodes).toEqual([
      "INVALID_SIGNATURE",
      "EXPIRED_PAYMENT",
      "DUPLICATE_NONCE",
      "SETTLEMENT_FAILED",
      "INVALID_AMOUNT",
    ]);
    expect(isKnownA2aX402ErrorCode("INVALID_SIGNATURE")).toBe(true);
    expect(isKnownA2aX402ErrorCode("SOMETHING_ELSE")).toBe(false);
  });
});

describe("parseA2aX402TaskPaymentMetadata", () => {
  it("parses a valid receipt envelope from task metadata", () => {
    expect(
      parseA2aX402TaskPaymentMetadata({
        metadata: {
          receipts: [
            {
              error: {
                code: "SETTLEMENT_FAILED",
                message: "Settlement failed",
              },
              network: "eip155:8453",
              payTo: "0xpayto",
              payer: "0xpayer",
              receiptId: "receipt-1",
              scheme: "exact",
              status: "failed",
              transactionHash: "0xtx",
            },
          ],
          status: "failed",
        },
      }),
    ).toEqual({
      success: true,
      data: {
        error: null,
        receipts: [
          {
            error: {
              code: "SETTLEMENT_FAILED",
              message: "Settlement failed",
            },
            network: "eip155:8453",
            payTo: "0xpayto",
            payer: "0xpayer",
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

  it("normalizes missing optional receipt fields", () => {
    expect(
      parseA2aX402TaskPaymentMetadata({
        metadata: {
          receipts: [
            {
              network: "eip155:8453",
              scheme: "exact",
              status: "pending",
            },
          ],
          status: "pending",
        },
      }),
    ).toEqual({
      success: true,
      data: {
        error: null,
        receipts: [
          {
            error: null,
            network: "eip155:8453",
            payTo: null,
            payer: null,
            receiptId: null,
            scheme: "exact",
            status: "pending",
            transactionHash: null,
          },
        ],
        status: "pending",
      },
    });
  });

  it("rejects malformed task metadata", () => {
    expect(
      parseA2aX402TaskPaymentMetadata({
        metadata: {
          receipts: [
            {
              network: 8453,
              scheme: "exact",
              status: "pending",
            },
          ],
          status: "pending",
        },
      }),
    ).toEqual({
      success: false,
      issues: ["receipts.0.network: Invalid input: expected string, received number"],
    });
  });

  it("fails when required envelope status is missing", () => {
    expect(
      parseA2aX402TaskPaymentMetadata({
        metadata: {
          receipts: [],
        },
      }),
    ).toEqual({
      success: false,
      issues: ["status: Invalid option: expected one of \"required\"|\"pending\"|\"settled\"|\"failed\""],
    });
  });

  it("fails when task metadata is absent", () => {
    expect(
      parseA2aX402TaskPaymentMetadata({}),
    ).toEqual({
      success: false,
      issues: ["status: Invalid option: expected one of \"required\"|\"pending\"|\"settled\"|\"failed\""],
    });
  });
});

describe("appendA2aX402ReceiptEnvelope", () => {
  it("appends new receipts without overwriting existing ones", () => {
    expect(
      appendA2aX402ReceiptEnvelope(
        {
          error: null,
          receipts: [
            {
              error: null,
              network: "eip155:8453",
              payTo: "0xpayto",
              payer: "0xpayer",
              receiptId: "receipt-1",
              scheme: "exact",
              status: "pending",
              transactionHash: null,
            },
          ],
          status: "pending",
        },
        {
          error: {
            code: "SETTLEMENT_FAILED",
            message: "Settlement failed",
          },
          receipts: [
            {
              error: null,
              network: "eip155:8453",
              payTo: "0xpayto",
              payer: "0xpayer",
              receiptId: "receipt-1",
              scheme: "exact",
              status: "pending",
              transactionHash: null,
            },
            {
              error: {
                code: "SETTLEMENT_FAILED",
                message: "Settlement failed",
              },
              network: "eip155:8453",
              payTo: "0xpayto",
              payer: "0xpayer",
              receiptId: "receipt-2",
              scheme: "exact",
              status: "failed",
              transactionHash: null,
            },
          ],
          status: "failed",
        },
      ),
    ).toEqual({
      error: {
        code: "SETTLEMENT_FAILED",
        message: "Settlement failed",
      },
      receipts: [
        {
          error: null,
          network: "eip155:8453",
          payTo: "0xpayto",
          payer: "0xpayer",
          receiptId: "receipt-1",
          scheme: "exact",
          status: "pending",
          transactionHash: null,
        },
        {
          error: {
            code: "SETTLEMENT_FAILED",
            message: "Settlement failed",
          },
          network: "eip155:8453",
          payTo: "0xpayto",
          payer: "0xpayer",
          receiptId: "receipt-2",
          scheme: "exact",
          status: "failed",
          transactionHash: null,
        },
      ],
      status: "failed",
    });
  });

  it("retains the existing envelope error when the incoming envelope has no error", () => {
    expect(
      appendA2aX402ReceiptEnvelope(
        {
          error: {
            code: "INVALID_SIGNATURE",
            message: "Invalid signature",
          },
          receipts: [],
          status: "failed",
        },
        {
          error: null,
          receipts: [],
          status: "pending",
        },
      ),
    ).toEqual({
      error: {
        code: "INVALID_SIGNATURE",
        message: "Invalid signature",
      },
      receipts: [],
      status: "pending",
    });
  });
});

describe("toA2aX402PaymentAttempts", () => {
  it("converts receipts into high-confidence payment attempt evidence", () => {
    expect(
      toA2aX402PaymentAttempts({
        error: null,
        receipts: [
          {
            error: null,
            network: "eip155:8453",
            payTo: "0xpayto",
            payer: "0xpayer",
            receiptId: "receipt-1",
            scheme: "exact",
            status: "settled",
            transactionHash: "0xtx",
          },
        ],
        status: "settled",
      }),
    ).toEqual([
      {
        confidenceScore: 900,
        confidenceTier: "high",
        errorCode: null,
        errorReason: null,
        network: "eip155:8453",
        payTo: "0xpayto",
        payer: "0xpayer",
        receiptId: "receipt-1",
        scheme: "exact",
        source: "a2a_x402_receipt",
        status: "settled",
        success: true,
        txHash: "0xtx",
      },
    ]);
  });

  it("creates an envelope-level failed attempt when no receipts are present", () => {
    expect(
      toA2aX402PaymentAttempts({
        error: {
          code: "INVALID_SIGNATURE",
          message: "Signature invalid",
        },
        receipts: [],
        status: "failed",
      }),
    ).toEqual([
      {
        confidenceScore: 900,
        confidenceTier: "high",
        errorCode: "INVALID_SIGNATURE",
        errorReason: "Signature invalid",
        network: null,
        payTo: null,
        payer: null,
        receiptId: null,
        scheme: null,
        source: "a2a_x402_receipt",
        status: "failed",
        success: false,
        txHash: null,
      },
    ]);
  });

  it("creates an empty envelope-level attempt when no receipts or envelope error are present", () => {
    expect(
      toA2aX402PaymentAttempts({
        error: null,
        receipts: [],
        status: "required",
      }),
    ).toEqual([
      {
        confidenceScore: 900,
        confidenceTier: "high",
        errorCode: null,
        errorReason: null,
        network: null,
        payTo: null,
        payer: null,
        receiptId: null,
        scheme: null,
        source: "a2a_x402_receipt",
        status: "required",
        success: false,
        txHash: null,
      },
    ]);
  });
});

describe("a2a-x402 ingest barrel exports", () => {
  it("re-exports receipt helpers", () => {
    expect(typeof a2aX402IngestExports.parseA2aX402TaskPaymentMetadata).toBe(
      "function",
    );
    expect(typeof a2aX402IngestExports.appendA2aX402ReceiptEnvelope).toBe(
      "function",
    );
    expect(typeof a2aX402IngestExports.toA2aX402PaymentAttempts).toBe(
      "function",
    );
    expect(
      typeof a2aX402IngestExports.a2aX402IngestModuleExports.receipts
        .toA2aX402PaymentAttempts,
    ).toBe("function");
  });
});
