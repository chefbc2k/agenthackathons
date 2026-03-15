import { z } from "zod";

import { createParser } from "./parse-result.js";

export const x402PaymentMetadataSchema = z
  .object({
    description: z.string().min(1).optional(),
    mimeType: z.string().min(1).optional(),
    outputSchema: z.string().url().optional(),
    resource: z.string().url().optional(),
  })
  .strict();

export const x402PaymentRequirementSchema = z
  .object({
    amount: z.string().min(1),
    asset: z.string().min(1),
    metadata: x402PaymentMetadataSchema.optional(),
    network: z.string().min(1),
    payTo: z.string().min(1),
    scheme: z.string().min(1),
  })
  .strict();

export const x402PaymentRequiredSchema = z
  .object({
    accepts: z.array(x402PaymentRequirementSchema).min(1),
  })
  .strict();

export const x402BazaarSchemaMetadataSchema = z
  .object({
    id: z.string().min(1).optional(),
    input: z.string().url().optional(),
    output: z.string().url().optional(),
  })
  .strict();

export const x402BazaarResourceSchema = z
  .object({
    amount: z.string().min(1).optional(),
    asset: z.string().min(1).optional(),
    network: z.string().min(1),
    payTo: z.string().min(1),
    resource: z.string().url(),
    scheme: z.string().min(1),
    schema: x402BazaarSchemaMetadataSchema.optional(),
  })
  .strict();

// Bazaar API v2 format
export const x402BazaarResourceV2ItemSchema = z.object({
  asset: z.string().min(1).optional(),
  description: z.string().optional(),
  maxAmountRequired: z.string().optional(),
  mimeType: z.string().optional(),
  network: z.string().min(1),
  outputSchema: z.unknown().optional(),
  payTo: z.string().min(1),
  resource: z.string().url(),
  scheme: z.string().min(1),
});

export const x402BazaarResourceV2Schema = z.object({
  accepts: z.array(x402BazaarResourceV2ItemSchema).min(1),
  resource: z.string().url(),
  type: z.string().optional(),
  x402Version: z.number().optional(),
  lastUpdated: z.string().optional(),
  metadata: z.unknown().optional(),
});

export const x402BazaarResourceListSchema = z.array(x402BazaarResourceSchema);

export const a2aX402ReceiptStatusSchema = z.enum([
  "required",
  "pending",
  "settled",
  "failed",
]);

export const a2aX402ReceiptErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const a2aX402ReceiptSchema = z
  .object({
    error: a2aX402ReceiptErrorSchema.optional(),
    network: z.string().min(1),
    payTo: z.string().min(1).optional(),
    payer: z.string().min(1).optional(),
    receiptId: z.string().min(1).optional(),
    scheme: z.string().min(1),
    status: a2aX402ReceiptStatusSchema,
    transactionHash: z.string().min(1).optional(),
  })
  .strict();

export const a2aX402ReceiptEnvelopeSchema = z
  .object({
    error: a2aX402ReceiptErrorSchema.optional(),
    receipts: z.array(a2aX402ReceiptSchema).optional(),
    status: a2aX402ReceiptStatusSchema,
  })
  .strict();

export type A2aX402Receipt = z.infer<typeof a2aX402ReceiptSchema>;
export type A2aX402ReceiptEnvelope = z.infer<
  typeof a2aX402ReceiptEnvelopeSchema
>;
export type A2aX402ReceiptError = z.infer<typeof a2aX402ReceiptErrorSchema>;
export type X402BazaarResource = z.infer<typeof x402BazaarResourceSchema>;
export type X402PaymentMetadata = z.infer<typeof x402PaymentMetadataSchema>;
export type X402PaymentRequired = z.infer<typeof x402PaymentRequiredSchema>;
export type X402PaymentRequirement = z.infer<
  typeof x402PaymentRequirementSchema
>;

export interface NormalizedX402PaymentMetadata {
  readonly description: string | null;
  readonly mimeType: string | null;
  readonly outputSchemaUrl: string | null;
  readonly resourceUrl: string | null;
}

export interface NormalizedX402PaymentRequirement {
  readonly amount: string;
  readonly asset: string;
  readonly metadata: NormalizedX402PaymentMetadata;
  readonly network: string;
  readonly payTo: string;
  readonly scheme: string;
}

export interface NormalizedX402PaymentRequired {
  readonly acceptedPayments: readonly NormalizedX402PaymentRequirement[];
}

export interface NormalizedX402BazaarSchemaMetadata {
  readonly inputSchemaUrl: string | null;
  readonly outputSchemaUrl: string | null;
  readonly schemaId: string | null;
}

export interface NormalizedX402BazaarResource {
  readonly amount: string | null;
  readonly asset: string | null;
  readonly network: string;
  readonly payTo: string;
  readonly resourceUrl: string;
  readonly schemaMetadata: NormalizedX402BazaarSchemaMetadata | null;
  readonly scheme: string;
}

export interface NormalizedA2aX402ReceiptError {
  readonly code: string;
  readonly message: string;
}

export interface NormalizedA2aX402Receipt {
  readonly error: NormalizedA2aX402ReceiptError | null;
  readonly network: string;
  readonly payTo: string | null;
  readonly payer: string | null;
  readonly receiptId: string | null;
  readonly scheme: string;
  readonly status: z.infer<typeof a2aX402ReceiptStatusSchema>;
  readonly transactionHash: string | null;
}

export interface NormalizedA2aX402ReceiptEnvelope {
  readonly error: NormalizedA2aX402ReceiptError | null;
  readonly receipts: readonly NormalizedA2aX402Receipt[];
  readonly status: z.infer<typeof a2aX402ReceiptStatusSchema>;
}

const normalizeReceiptError = (
  error: A2aX402ReceiptError | undefined,
): NormalizedA2aX402ReceiptError | null => {
  if (!error) {
    return null;
  }

  return {
    code: error.code,
    message: error.message,
  };
};

export const normalizeX402PaymentRequired = (
  paymentRequired: X402PaymentRequired,
): NormalizedX402PaymentRequired => {
  return {
    acceptedPayments: paymentRequired.accepts.map((acceptance) => ({
      amount: acceptance.amount,
      asset: acceptance.asset,
      metadata: {
        description: acceptance.metadata?.description ?? null,
        mimeType: acceptance.metadata?.mimeType ?? null,
        outputSchemaUrl: acceptance.metadata?.outputSchema ?? null,
        resourceUrl: acceptance.metadata?.resource ?? null,
      },
      network: acceptance.network,
      payTo: acceptance.payTo,
      scheme: acceptance.scheme,
    })),
  };
};

export const normalizeX402BazaarResource = (
  resource: X402BazaarResource,
): NormalizedX402BazaarResource => {
  return {
    amount: resource.amount ?? null,
    asset: resource.asset ?? null,
    network: resource.network,
    payTo: resource.payTo,
    resourceUrl: resource.resource,
    schemaMetadata: resource.schema
      ? {
          inputSchemaUrl: resource.schema.input ?? null,
          outputSchemaUrl: resource.schema.output ?? null,
          schemaId: resource.schema.id ?? null,
        }
      : null,
    scheme: resource.scheme,
  };
};

export const normalizeX402BazaarResourceList = (
  resources: readonly X402BazaarResource[],
): readonly NormalizedX402BazaarResource[] => {
  return resources.map(normalizeX402BazaarResource);
};

export const normalizeA2aX402ReceiptEnvelope = (
  receiptEnvelope: A2aX402ReceiptEnvelope,
): NormalizedA2aX402ReceiptEnvelope => {
  return {
    error: normalizeReceiptError(receiptEnvelope.error),
    receipts:
      receiptEnvelope.receipts?.map((receipt) => ({
        error: normalizeReceiptError(receipt.error),
        network: receipt.network,
        payTo: receipt.payTo ?? null,
        payer: receipt.payer ?? null,
        receiptId: receipt.receiptId ?? null,
        scheme: receipt.scheme,
        status: receipt.status,
        transactionHash: receipt.transactionHash ?? null,
      })) ?? [],
    status: receiptEnvelope.status,
  };
};

export const parseX402PaymentRequired = createParser(
  x402PaymentRequiredSchema,
  normalizeX402PaymentRequired,
);

export const parseX402BazaarResource = (input: unknown) => {
  // Try v2 format first
  const v2Result = x402BazaarResourceV2Schema.safeParse(input);
  if (v2Result.success) {
    // Extract first accept entry and transform to v1 format
    const firstAccept = v2Result.data.accepts[0]!;
    const v1Format: X402BazaarResource = {
      amount: firstAccept.maxAmountRequired,
      asset: firstAccept.asset,
      network: firstAccept.network,
      payTo: firstAccept.payTo,
      resource: firstAccept.resource,
      scheme: firstAccept.scheme,
      schema: firstAccept.outputSchema ? {
        output: typeof firstAccept.outputSchema === 'string' ? firstAccept.outputSchema : undefined,
      } : undefined,
    };
    return {
      success: true as const,
      data: normalizeX402BazaarResource(v1Format),
    };
  }

  // Fall back to v1 format
  return createParser(x402BazaarResourceSchema, normalizeX402BazaarResource)(input);
};

export const parseX402BazaarResourceList = createParser(
  x402BazaarResourceListSchema,
  normalizeX402BazaarResourceList,
);

export const parseA2aX402ReceiptEnvelope = createParser(
  a2aX402ReceiptEnvelopeSchema,
  normalizeA2aX402ReceiptEnvelope,
);
