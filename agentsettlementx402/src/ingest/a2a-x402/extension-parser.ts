import type { ParseResult } from "../../core/parse-result.js";

/**
 * A2A x402 Extension v0.1 Specification
 * https://github.com/google-a2a/a2a-x402/v0.1
 */

// Canonical extension URI from spec
export const X402_EXTENSION_URI = "https://github.com/google-a2a/a2a-x402/v0.1";

/**
 * x402SettleResponse - Receipt object from A2A x402 spec
 * Represents one payment settlement attempt
 */
export interface X402SettleResponse {
  readonly success: boolean;
  readonly errorReason?: string; // Optional, present on failure
  readonly transaction?: string; // Optional, only present if success=true
  readonly network: string;
  readonly payer?: string; // Optional
}

/**
 * x402PaymentRequirements - Payment requirements from spec
 * Contains the economic details (amount, payTo, asset, etc.)
 */
export interface X402PaymentRequirements {
  readonly payTo: string;
  readonly asset: string;
  readonly maxAmountRequired: string;
  readonly network: string;
  readonly resource: string;
  readonly scheme: string;
}

/**
 * A2A x402 Payment Metadata
 * Contains all payment state from task metadata
 */
export interface A2aX402PaymentMetadata {
  readonly status: string; // payment-required, payment-submitted, payment-rejected, payment-verified, payment-completed, payment-failed
  readonly required: X402PaymentRequirements | null;
  readonly receipts: readonly X402SettleResponse[];
  readonly error: string | null;
}

/**
 * Normalized Payment Attempt
 * Combines receipt (outcome) + requirements (context)
 * This is what we persist to payment_events table
 */
export interface NormalizedPaymentAttempt {
  readonly taskId: string;
  readonly contextId: string | null;
  readonly attemptIndex: number;
  readonly success: boolean;
  readonly errorReason: string | null;
  readonly transactionHash: string | null;
  readonly network: string;
  readonly payer: string | null;
  // Joined from requirements:
  readonly payTo: string;
  readonly asset: string;
  readonly maxAmountRequired: string;
  readonly resource: string;
  readonly scheme: string;
}

/**
 * Parse A2A x402 payment metadata from task metadata
 * Supports both dotted keys (spec literal) and nested objects (implementation convenience)
 *
 * Spec metadata keys:
 * - x402.payment.status
 * - x402.payment.required
 * - x402.payment.receipts
 * - x402.payment.error
 */
export const parseA2aX402Metadata = (
  taskMetadata: unknown,
): ParseResult<A2aX402PaymentMetadata> => {
  if (!taskMetadata || typeof taskMetadata !== "object") {
    return {
      success: false,
      error: "Task metadata must be an object",
    };
  }

  const metadata = taskMetadata as Record<string, unknown>;

  // Try dotted keys first (spec literal)
  let status = metadata["x402.payment.status"];
  let required = metadata["x402.payment.required"];
  let receipts = metadata["x402.payment.receipts"];
  let error = metadata["x402.payment.error"];

  // Fallback to nested form (implementation convenience)
  if (!status && metadata.x402 && typeof metadata.x402 === "object") {
    const x402 = metadata.x402 as Record<string, unknown>;
    if (x402.payment && typeof x402.payment === "object") {
      const payment = x402.payment as Record<string, unknown>;
      status = payment.status;
      required = payment.required;
      receipts = payment.receipts;
      error = payment.error;
    }
  }

  // Validate receipts array
  const receiptArray: readonly X402SettleResponse[] = Array.isArray(receipts)
    ? receipts
        .filter((r): r is X402SettleResponse => {
          return (
            r &&
            typeof r === "object" &&
            "success" in r &&
            typeof (r as { success: unknown }).success === "boolean" &&
            "network" in r &&
            typeof (r as { network: unknown }).network === "string"
          );
        })
    : [];

  // Parse requirements
  let parsedRequirements: X402PaymentRequirements | null = null;
  if (required && typeof required === "object") {
    const req = required as Record<string, unknown>;
    if (
      typeof req.payTo === "string" &&
      typeof req.asset === "string" &&
      typeof req.maxAmountRequired === "string" &&
      typeof req.network === "string" &&
      typeof req.resource === "string" &&
      typeof req.scheme === "string"
    ) {
      parsedRequirements = {
        payTo: req.payTo,
        asset: req.asset,
        maxAmountRequired: req.maxAmountRequired,
        network: req.network,
        resource: req.resource,
        scheme: req.scheme,
      };
    }
  }

  return {
    success: true,
    data: {
      status: typeof status === "string" ? status : "unknown",
      required: parsedRequirements,
      receipts: receiptArray,
      error: typeof error === "string" ? error : null,
    },
  };
};

/**
 * Normalize receipts into payment attempts
 * Joins each receipt with the requirements context
 */
export const normalizePaymentAttempts = (
  taskId: string,
  contextId: string | null,
  metadata: A2aX402PaymentMetadata,
): readonly NormalizedPaymentAttempt[] => {
  if (!metadata.required) {
    // Can't normalize without requirements context
    return [];
  }

  return metadata.receipts.map((receipt, index) => ({
    taskId,
    contextId,
    attemptIndex: index,
    success: receipt.success,
    errorReason: receipt.errorReason ?? null,
    transactionHash: receipt.transaction ?? null,
    network: receipt.network,
    payer: receipt.payer ?? null,
    // Context from requirements:
    payTo: metadata.required!.payTo,
    asset: metadata.required!.asset,
    maxAmountRequired: metadata.required!.maxAmountRequired,
    resource: metadata.required!.resource,
    scheme: metadata.required!.scheme,
  }));
};
