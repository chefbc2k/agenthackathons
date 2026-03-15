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

export const graphNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["agent", "service"]),
    label: z.string().min(1),
    score: z.number().min(0).max(100).optional(),
  })
  .strict();

export const graphEdgeSchema = z
  .object({
    source: z.string().min(1),
    target: z.string().min(1),
    confidence: z.string().min(1),
    weight: z.number().int().min(0).max(1000),
  })
  .strict();

export const graphDataResponseSchema = z
  .object({
    nodes: z.array(graphNodeSchema),
    edges: z.array(graphEdgeSchema),
  })
  .strict();

export const dashboardStatsResponseSchema = z
  .object({
    totalAgents: z.number().int().min(0),
    totalServices: z.number().int().min(0),
    totalLinks: z.number().int().min(0),
    avgReputationScore: z.number().min(0).max(100),
    recentActivity: z
      .object({
        events7d: z.number().int().min(0),
        events30d: z.number().int().min(0),
      })
      .strict(),
    confidenceDistribution: z
      .object({
        low: z.number().int().min(0),
        medium: z.number().int().min(0),
        high: z.number().int().min(0),
        verified: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export const timelineDataPointSchema = z
  .object({
    date: z.string().min(1),
    eventCount: z.number().int().min(0),
    avgSuccessRate: z.number().min(0).max(1),
  })
  .strict();

export const timelineDataResponseSchema = z
  .object({
    dataPoints: z.array(timelineDataPointSchema),
  })
  .strict();

export const topAgentSchema = z
  .object({
    agentId: z.string().min(1),
    displayName: z.string().min(1),
    score: z.number().min(0).max(100),
    serviceCount: z.number().int().min(0),
  })
  .strict();

export const topAgentsResponseSchema = z
  .object({
    items: z.array(topAgentSchema),
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
export type GraphDataResponse = z.infer<typeof graphDataResponseSchema>;
export type DashboardStatsResponse = z.infer<
  typeof dashboardStatsResponseSchema
>;
export type TimelineDataResponse = z.infer<typeof timelineDataResponseSchema>;
export type TopAgentsResponse = z.infer<typeof topAgentsResponseSchema>;
