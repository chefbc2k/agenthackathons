import { z } from "zod";

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const pageInfoSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();

export const agentSummarySchema = z
  .object({
    agentCardUrl: z.string().url(),
    displayName: z.string().min(1),
    id: z.string().min(1),
    providerOrganization: z.string().nullable(),
    providerUrl: z.string().url().nullable(),
  })
  .strict();

export const agentDetailSchema = agentSummarySchema;

export const serviceSummarySchema = z
  .object({
    id: z.string().min(1),
    network: z.string().min(1),
    payToWalletId: z.string().min(1),
    resourceUrl: z.string().url(),
    scheme: z.string().min(1),
  })
  .strict();

export const serviceDetailSchema = serviceSummarySchema.extend({
  amount: z.string().nullable(),
  asset: z.string().nullable(),
  description: z.string().nullable(),
  inputSchemaUrl: z.string().url().nullable(),
  mimeType: z.string().nullable(),
  outputSchemaUrl: z.string().url().nullable(),
  schemaId: z.string().nullable(),
});

export const debugAgentResponseSchema = agentDetailSchema.extend({
  debug: z
    .object({
      agentCard: z
        .object({
          normalizedJson: z.unknown(),
          rawJson: z.unknown(),
          rawJsonHash: z.string().min(1),
          signatureVerificationStatus: z.string().min(1),
        })
        .nullable(),
    })
    .strict(),
});

export const debugServiceResponseSchema = serviceDetailSchema.extend({
  debug: z
    .object({
      rawSourceJson: z.unknown(),
      sourceFingerprint: z.string().min(1),
    })
    .strict(),
});

export const observableMetricsResponseSchema = z
  .object({
    agentId: z.string().min(1),
    asOf: z.string().datetime(),
    derivedProxies: z
      .object({
        retryIntensity: z
          .object({
            attemptsWithGroupKey: z.number().int().min(0),
            averageAttemptsPerGroup: z.number().nullable(),
            groupedAttemptCount: z.number().int().min(0),
            groupsWithRetries: z.number().int().min(0),
          })
          .strict(),
      })
      .strict(),
    recency: z
      .object({
        eventCount7d: z.number().int().min(0),
        eventCount30d: z.number().int().min(0),
        uniquePayerCount7d: z.number().int().min(0),
        uniquePayerCount30d: z.number().int().min(0),
      })
      .strict(),
    serviceId: z.string().min(1),
    success: z
      .object({
        failureCount: z.number().int().min(0),
        observableAttemptCount: z.number().int().min(0),
        successCount: z.number().int().min(0),
        successRate: z.number().min(0).max(1).nullable(),
      })
      .strict(),
    usage: z
      .object({
        eventCount: z.number().int().min(0),
        uniquePayerCount: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export const reputationResponseSchema = z
  .object({
    agentId: z.string().min(1),
    confidenceTier: z.enum(["low", "medium", "high"]),
    explanation: z
      .object({
        diversityFactor: z.number().min(0).max(1),
        inferenceLabel: z.literal("inference"),
        observableAttemptCount: z.number().int().min(0),
        payerDiversityRatio: z.number().min(0).max(1),
        rawSuccessRate: z.number().min(0).max(1).nullable(),
        recencyFactor: z.number().min(0).max(1),
        retryPenalty: z.number().min(0).max(1),
        weightedSuccessRate: z.number().min(0).max(1),
      })
      .strict(),
    inferenceLabel: z.literal("inference"),
    score: z.number().min(0).max(100),
    serviceId: z.string().min(1),
  })
  .strict();

export const healthResponseSchema = z
  .object({
    status: z.literal("ok"),
  })
  .strict();

export const agentsListResponseSchema = z
  .object({
    items: z.array(agentSummarySchema),
    page: pageInfoSchema,
  })
  .strict();

export const servicesListResponseSchema = z
  .object({
    items: z.array(serviceSummarySchema),
    page: pageInfoSchema,
  })
  .strict();

export const apiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type AgentDetailResponse = z.infer<typeof agentDetailSchema>;
export type AgentSummaryResponse = z.infer<typeof agentSummarySchema>;
export type AgentsListResponse = z.infer<typeof agentsListResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type DebugAgentResponse = z.infer<typeof debugAgentResponseSchema>;
export type DebugServiceResponse = z.infer<typeof debugServiceResponseSchema>;
export type ObservableMetricsResponse = z.infer<
  typeof observableMetricsResponseSchema
>;
export type PageInfo = z.infer<typeof pageInfoSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type ReputationResponse = z.infer<typeof reputationResponseSchema>;
export type ServiceDetailResponse = z.infer<typeof serviceDetailSchema>;
export type ServiceSummaryResponse = z.infer<typeof serviceSummarySchema>;
export type ServicesListResponse = z.infer<typeof servicesListResponseSchema>;
