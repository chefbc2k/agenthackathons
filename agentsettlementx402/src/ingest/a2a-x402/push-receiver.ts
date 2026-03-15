import type { X402PaymentRequirements, X402SettleResponse } from "./extension-parser.js";
import {
  type NormalizedPaymentAttempt,
  normalizePaymentAttempts,
  parseA2aX402Metadata,
} from "./extension-parser.js";

/**
 * Receipt Push Payload
 * Sent by partner agents via webhook when task payment state changes
 */
export interface ReceiptPushPayload {
  readonly agentId: string;
  readonly taskId: string;
  readonly contextId: string | null;
  readonly metadata: ReceiptPushMetadata;
  readonly signature: string; // HMAC signature for verification
  readonly timestamp?: number; // Optional timestamp for replay attack prevention
}

/**
 * Metadata in push payload
 * Can use either dotted keys or nested structure
 */
export type ReceiptPushMetadata =
  | {
      readonly "x402.payment.status": string;
      readonly "x402.payment.required": X402PaymentRequirements;
      readonly "x402.payment.receipts": readonly X402SettleResponse[];
      readonly "x402.payment.error"?: string;
    }
  | {
      readonly x402: {
        readonly payment: {
          readonly status: string;
          readonly required: X402PaymentRequirements;
          readonly receipts: readonly X402SettleResponse[];
          readonly error?: string;
        };
      };
    };

/**
 * Signature verification function type
 * Implement with HMAC-SHA256 using shared secret
 */
export type SignatureVerifier = (
  payload: unknown,
  signature: string,
  timestamp?: number,
) => boolean;

/**
 * Receive and process receipt push from partner agent
 * Verifies HMAC signature before processing
 *
 * @param payload Receipt push payload from partner
 * @param verifySignature HMAC signature verification function
 * @returns Normalized payment attempts from the pushed task
 * @throws Error if signature verification fails
 */
export const receiveReceiptPush = async (
  payload: ReceiptPushPayload,
  verifySignature: SignatureVerifier,
): Promise<readonly NormalizedPaymentAttempt[]> => {
  // 1. Verify HMAC signature
  if (!verifySignature(payload, payload.signature, payload.timestamp)) {
    throw new Error("Invalid signature - webhook authentication failed");
  }

  // 2. Check timestamp for replay attack prevention (optional)
  if (payload.timestamp) {
    const now = Date.now();
    const fiveMinutesMs = 5 * 60 * 1000;

    if (Math.abs(now - payload.timestamp) > fiveMinutesMs) {
      throw new Error(
        "Timestamp too old - possible replay attack",
      );
    }
  }

  // 3. Parse x402 metadata
  const parseResult = parseA2aX402Metadata(payload.metadata);

  if (!parseResult.success) {
    throw new Error(
      `Invalid x402 metadata: ${parseResult.error}`,
    );
  }

  const metadata = parseResult.data;

  // 4. Normalize receipts
  const attempts = normalizePaymentAttempts(
    payload.taskId,
    payload.contextId,
    metadata,
  );

  return attempts;
};

/**
 * Create HMAC signature verifier using shared secret
 * Uses SHA-256 algorithm
 *
 * @param secret Shared secret key
 * @returns Signature verification function
 */
export const createHmacVerifier = (secret: string): SignatureVerifier => {
  return async (payload: unknown, signature: string, timestamp?: number) => {
    try {
      // Create payload string (excluding signature field)
      const payloadCopy = { ...(payload as object) };
      delete (payloadCopy as { signature?: string }).signature;

      const payloadString = JSON.stringify(payloadCopy);

      // Compute HMAC-SHA256
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(payloadString);

      // Import key for HMAC
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
      );

      // Compute signature
      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        messageData,
      );

      // Convert to hex string
      const computedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Constant-time comparison (timing-safe)
      return computedSignature === signature.toLowerCase();
    } catch (error) {
      console.error("HMAC verification error:", error);
      return false;
    }
  };
};

/**
 * Batch receive multiple receipt pushes
 * Processes in parallel with error handling
 *
 * @param payloads Array of receipt push payloads
 * @param verifySignature Signature verification function
 * @returns Successfully processed attempts and errors
 */
export const receiveBatchReceiptPushes = async (
  payloads: readonly ReceiptPushPayload[],
  verifySignature: SignatureVerifier,
): Promise<{
  readonly attempts: readonly NormalizedPaymentAttempt[];
  readonly errors: readonly { readonly payload: ReceiptPushPayload; readonly error: string }[];
}> => {
  const results = await Promise.allSettled(
    payloads.map((payload) => receiveReceiptPush(payload, verifySignature)),
  );

  const allAttempts: NormalizedPaymentAttempt[] = [];
  const errors: { readonly payload: ReceiptPushPayload; readonly error: string }[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      allAttempts.push(...result.value);
    } else {
      errors.push({
        payload: payloads[index]!,
        error: result.reason?.message ?? "Unknown error",
      });
    }
  });

  return {
    attempts: allAttempts,
    errors,
  };
};
