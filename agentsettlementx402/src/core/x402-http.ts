import { z } from "zod";

import { createParser, type ParseResult } from "./parse-result.js";
import {
  normalizeX402PaymentRequired,
  x402PaymentRequiredSchema,
} from "./x402.js";

export interface RawHttpHeaders {
  readonly [headerName: string]: string | undefined;
}

export interface X402HttpTranscript {
  readonly body?: unknown;
  readonly headers: RawHttpHeaders;
}

export const x402SettlementResponseSchema = z
  .object({
    errorReason: z.string().min(1).optional(),
    network: z.string().min(1).optional(),
    payTo: z.string().min(1).optional(),
    payer: z.string().min(1).optional(),
    success: z.boolean(),
    transaction: z.string().min(1).optional(),
  })
  .strict();

export type X402SettlementResponse = z.infer<typeof x402SettlementResponseSchema>;

export interface NormalizedX402SettlementResponse {
  readonly errorReason: string | null;
  readonly network: string | null;
  readonly payTo: string | null;
  readonly payer: string | null;
  readonly success: boolean;
  readonly txHash: string | null;
}

export interface NormalizedX402PaymentAttempt {
  readonly errorReason: string | null;
  readonly network: string | null;
  readonly payTo: string | null;
  readonly payer: string | null;
  readonly success: boolean;
  readonly txHash: string | null;
}

const normalizeSettlementResponse = (
  response: X402SettlementResponse,
): NormalizedX402SettlementResponse => {
  return {
    errorReason: response.errorReason ?? null,
    network: response.network ?? null,
    payTo: response.payTo ?? null,
    payer: response.payer ?? null,
    success: response.success,
    txHash: response.transaction ?? null,
  };
};

const settlementHeaderNames = [
  "payment-response",
  "x-payment-response",
] as const;

const readSettlementHeader = (
  headers: RawHttpHeaders,
): string | null => {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  ) as RawHttpHeaders;

  for (const headerName of settlementHeaderNames) {
    const headerValue = normalizedHeaders[headerName];

    if (headerValue) {
      return headerValue;
    }
  }

  return null;
};

const parseSettlementHeaderValue = (
  headerValue: string,
): ParseResult<NormalizedX402SettlementResponse> => {
  let parsedHeader: unknown;

  try {
    parsedHeader = JSON.parse(headerValue) as unknown;
  } catch {
    return {
      success: false,
      issues: ["payment-response header: Invalid JSON response"],
    };
  }

  return parseX402SettlementResponse(parsedHeader);
};

export const parseX402PaymentRequiredBody = createParser(
  x402PaymentRequiredSchema,
  normalizeX402PaymentRequired,
);

export const parseX402SettlementResponse = createParser(
  x402SettlementResponseSchema,
  normalizeSettlementResponse,
);

export const parseX402SettlementResponseHeader = (
  headers: RawHttpHeaders,
): ParseResult<NormalizedX402SettlementResponse> => {
  const headerValue = readSettlementHeader(headers);

  if (!headerValue) {
    return {
      success: false,
      issues: ["payment-response header: Missing payment response header"],
    };
  }

  return parseSettlementHeaderValue(headerValue);
};

export const normalizeX402PaymentAttemptTranscript = (
  transcript: X402HttpTranscript,
): ParseResult<NormalizedX402PaymentAttempt> => {
  const settlementResult = parseX402SettlementResponseHeader(transcript.headers);

  if (settlementResult.success) {
    const paymentRequiredResult = transcript.body
      ? parseX402PaymentRequiredBody(transcript.body)
      : null;
    const acceptedPayment = paymentRequiredResult?.success
      ? paymentRequiredResult.data.acceptedPayments[0]
      : null;

    return {
      success: true,
      data: {
        errorReason: settlementResult.data.errorReason,
        network: settlementResult.data.network ?? acceptedPayment?.network ?? null,
        payTo: settlementResult.data.payTo ?? acceptedPayment?.payTo ?? null,
        payer: settlementResult.data.payer,
        success: settlementResult.data.success,
        txHash: settlementResult.data.txHash,
      },
    };
  }

  const paymentRequiredResult = transcript.body
    ? parseX402PaymentRequiredBody(transcript.body)
    : null;

  if (!paymentRequiredResult?.success) {
    return settlementResult;
  }

  const acceptedPayment = paymentRequiredResult.data.acceptedPayments[0]!;

  return {
    success: true,
    data: {
      errorReason: null,
      network: acceptedPayment.network,
      payTo: acceptedPayment.payTo,
      payer: null,
      success: false,
      txHash: null,
    },
  };
};
