import {
  type NormalizedA2aX402Receipt,
  type NormalizedA2aX402ReceiptEnvelope,
  parseA2aX402ReceiptEnvelope,
} from "../../core/x402.js";
import { hashStableJson } from "../../core/stable-json.js";
import type { ParseResult } from "../../core/parse-result.js";

export const a2aX402KnownErrorCodes = [
  "INVALID_SIGNATURE",
  "EXPIRED_PAYMENT",
  "DUPLICATE_NONCE",
  "SETTLEMENT_FAILED",
  "INVALID_AMOUNT",
] as const;

export type A2aX402KnownErrorCode = (typeof a2aX402KnownErrorCodes)[number];

export interface A2aX402TaskMessage {
  readonly metadata?: unknown;
}

export interface NormalizedA2aX402PaymentAttemptEvidence {
  readonly confidenceScore: 900;
  readonly confidenceTier: "high";
  readonly errorCode: string | null;
  readonly errorReason: string | null;
  readonly network: string | null;
  readonly payTo: string | null;
  readonly payer: string | null;
  readonly receiptId: string | null;
  readonly scheme: string | null;
  readonly source: "a2a_x402_receipt";
  readonly status: NormalizedA2aX402ReceiptEnvelope["status"];
  readonly success: boolean;
  readonly txHash: string | null;
}

const receiptFingerprint = (receipt: NormalizedA2aX402Receipt): string => {
  return hashStableJson(receipt);
};

export const isKnownA2aX402ErrorCode = (
  code: string,
): code is A2aX402KnownErrorCode => {
  return (a2aX402KnownErrorCodes as readonly string[]).includes(code);
};

export const parseA2aX402TaskPaymentMetadata = (
  taskMessage: A2aX402TaskMessage,
): ParseResult<NormalizedA2aX402ReceiptEnvelope> => {
  return parseA2aX402ReceiptEnvelope(taskMessage.metadata ?? {});
};

export const appendA2aX402ReceiptEnvelope = (
  existing: NormalizedA2aX402ReceiptEnvelope,
  incoming: NormalizedA2aX402ReceiptEnvelope,
): NormalizedA2aX402ReceiptEnvelope => {
  const seenFingerprints = new Set(
    existing.receipts.map((receipt) => receiptFingerprint(receipt)),
  );
  const appendedReceipts = incoming.receipts.filter((receipt) => {
    const fingerprint = receiptFingerprint(receipt);

    if (seenFingerprints.has(fingerprint)) {
      return false;
    }

    seenFingerprints.add(fingerprint);
    return true;
  });

  return {
    error: incoming.error ?? existing.error,
    receipts: [...existing.receipts, ...appendedReceipts],
    status: incoming.status,
  };
};

const toAttemptFromReceipt = (
  receipt: NormalizedA2aX402Receipt,
  envelopeStatus: NormalizedA2aX402ReceiptEnvelope["status"],
): NormalizedA2aX402PaymentAttemptEvidence => {
  return {
    confidenceScore: 900,
    confidenceTier: "high",
    errorCode: receipt.error?.code ?? null,
    errorReason: receipt.error?.message ?? null,
    network: receipt.network,
    payTo: receipt.payTo,
    payer: receipt.payer,
    receiptId: receipt.receiptId,
    scheme: receipt.scheme,
    source: "a2a_x402_receipt",
    status: envelopeStatus,
    success: receipt.status === "settled",
    txHash: receipt.transactionHash,
  };
};

export const toA2aX402PaymentAttempts = (
  envelope: NormalizedA2aX402ReceiptEnvelope,
): readonly NormalizedA2aX402PaymentAttemptEvidence[] => {
  if (envelope.receipts.length > 0) {
    return envelope.receipts.map((receipt) =>
      toAttemptFromReceipt(receipt, envelope.status),
    );
  }

  return [
    {
      confidenceScore: 900,
      confidenceTier: "high",
      errorCode: envelope.error?.code ?? null,
      errorReason: envelope.error?.message ?? null,
      network: null,
      payTo: null,
      payer: null,
      receiptId: null,
      scheme: null,
      source: "a2a_x402_receipt",
      status: envelope.status,
      success: false,
      txHash: null,
    },
  ];
};
