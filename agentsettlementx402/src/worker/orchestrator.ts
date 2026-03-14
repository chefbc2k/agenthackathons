import type { z } from "zod";

import { z as schema } from "zod";

import {
  type AgentCardIngestionOptions,
  ingestAgentCards,
} from "../ingest/a2a/agent-cards.js";
import {
  type A2aPersistenceRepositories,
  persistIngestedAgentCard,
} from "../ingest/a2a/persist.js";
import {
  type BazaarIngestionOptions,
  ingestBazaarResourceRecords,
} from "../ingest/x402/bazaar.js";
import {
  type BazaarPersistenceRepositories,
  persistBazaarResources,
  toPersistableBazaarResource,
} from "../ingest/x402/persist.js";
import {
  linkAgentsToServices,
  type LinkAgentsToServicesOptions,
  type LinkableAgent,
  type LinkableService,
} from "../linking/agent-service.js";
import { persistAgentServiceLink } from "../linking/persist.js";
import {
  computeMetrics,
  type ObservableMetricEvent,
} from "../metrics/observable.js";
import { persistComputedMetrics } from "../metrics/persist.js";
import {
  type LinkEdgeRecord,
  type ObservableMetricsRecord,
  type ObservableMetricsRepository,
  type ServiceRecord,
} from "../db/repositories.js";
import {
  scoreReputation,
  type ReputationEvidenceType,
  type ReputationScoreResult,
} from "../scoring/reputation.js";

export const workerJobStageValues = [
  "a2a",
  "bazaar",
  "linking",
  "metrics",
] as const;

export type WorkerJobStage = (typeof workerJobStageValues)[number];

export const workerJobPayloadSchema = schema
  .object({
    agentDomains: schema.array(schema.string().min(1)).optional(),
    facilitatorBaseUrl: schema.string().url().nullable().optional(),
    jobKey: schema.string().min(1).optional(),
    kind: schema.literal("sync_all"),
    stages: schema.array(schema.enum(workerJobStageValues)).optional(),
  })
  .strict();

export type WorkerJobPayload = z.infer<typeof workerJobPayloadSchema>;

export interface WorkerMetricsInput {
  readonly agentId: string;
  readonly evidenceTypes: readonly ReputationEvidenceType[];
  readonly observations: readonly ObservableMetricEvent[];
  readonly serviceId: string;
}

export interface WorkerStateSnapshot {
  readonly agents: readonly LinkableAgent[];
  readonly services: readonly LinkableService[];
}

export interface WorkerDependencies {
  readonly a2aIngestionOptions?: AgentCardIngestionOptions;
  readonly a2aRepositories: A2aPersistenceRepositories;
  readonly bazaarIngestionOptions?: BazaarIngestionOptions;
  readonly bazaarRepositories: BazaarPersistenceRepositories;
  readonly linkingOptions?: LinkAgentsToServicesOptions;
  readonly listLinkableState: () => Promise<WorkerStateSnapshot>;
  readonly listMetricInputs: (asOf: Date) => Promise<readonly WorkerMetricsInput[]>;
  readonly metricsRepository: ObservableMetricsRepository;
  readonly now?: () => Date;
}

export interface WorkerStageRunSummary {
  readonly created: number;
  readonly noop: number;
  readonly processed: number;
  readonly skipped: boolean;
  readonly updated: number;
}

export interface WorkerMetricsStageSummary extends WorkerStageRunSummary {
  readonly scores: readonly ReputationScoreResult[];
}

export interface WorkerRunResult {
  readonly completedAt: Date;
  readonly jobKey: string | null;
  readonly stages: {
    readonly a2a: WorkerStageRunSummary;
    readonly bazaar: WorkerStageRunSummary;
    readonly linking: WorkerStageRunSummary;
    readonly metrics: WorkerMetricsStageSummary;
  };
}

const emptyStageSummary = (skipped: boolean): WorkerStageRunSummary => ({
  created: 0,
  noop: 0,
  processed: 0,
  skipped,
  updated: 0,
});

const emptyMetricsStageSummary = (skipped: boolean): WorkerMetricsStageSummary => ({
  ...emptyStageSummary(skipped),
  scores: [],
});

const toStageSet = (
  stages: readonly WorkerJobStage[] | undefined,
): ReadonlySet<WorkerJobStage> => {
  return new Set(stages ?? workerJobStageValues);
};

const countActions = (
  actions: readonly ("created" | "updated" | "noop")[],
): WorkerStageRunSummary => {
  return {
    created: actions.filter((action) => action === "created").length,
    noop: actions.filter((action) => action === "noop").length,
    processed: actions.length,
    skipped: false,
    updated: actions.filter((action) => action === "updated").length,
  };
};

export const createEmptyWorkerDependencies = (): WorkerDependencies => {
  const agentMap = new Map<string, LinkableAgent>();
  const agentCardMap = new Map<
    string,
    {
      readonly description: string | null;
      readonly documentationUrl: string | null;
      readonly normalizedJson: unknown;
      readonly rawJson: unknown;
      readonly rawJsonHash: string;
      readonly signatureVerificationStatus:
        | "failed"
        | "unverified"
        | "unsupported"
        | "verified";
    }
  >();
  const serviceMap = new Map<string, LinkableService>();
  const serviceRecordMap = new Map<string, ServiceRecord>();
  const linkEdgeMap = new Map<string, LinkEdgeRecord>();
  const metricsMap = new Map<string, ObservableMetricsRecord>();

  return {
    a2aRepositories: {
      agentCards: {
        findByAgentId: (agentId) =>
          Promise.resolve(
            agentCardMap.get(agentId)
              ? {
                  ...agentCardMap.get(agentId)!,
                  agentId,
                  id: `agent-card:${agentId}`,
                }
              : null,
          ),
        upsert: (input) => {
          agentCardMap.set(input.agentId, {
            description: input.description,
            documentationUrl: input.documentationUrl,
            normalizedJson: input.normalizedJson,
            rawJson: input.rawJson,
            rawJsonHash: input.rawJsonHash,
            signatureVerificationStatus: input.signatureVerificationStatus,
          });

          return Promise.resolve({
            agentId: input.agentId,
            description: input.description,
            documentationUrl: input.documentationUrl,
            id: `agent-card:${input.agentId}`,
            normalizedJson: input.normalizedJson,
            rawJson: input.rawJson,
            rawJsonHash: input.rawJsonHash,
            signatureVerificationStatus: input.signatureVerificationStatus,
          });
        },
      },
      agents: {
        create: (input) =>
          Promise.resolve({
            agentCardUrl: input.agentCardUrl,
            displayName: input.displayName,
            id: `agent:${input.agentCardUrl}`,
            providerOrganization: input.providerOrganization,
            providerUrl: input.providerUrl,
          }),
        findByAgentCardUrl: (agentCardUrl) =>
          Promise.resolve(agentMap.get(agentCardUrl) ?? null),
        upsert: (input) => {
          const agent: LinkableAgent = {
            agentCardUrl: input.agentCardUrl,
            declaredServiceBindings: [],
            displayName: input.displayName,
            id: `agent:${input.agentCardUrl}`,
            providerOrganization: input.providerOrganization,
            providerUrl: input.providerUrl,
            signatureVerificationStatus: "unverified",
          };
          agentMap.set(input.agentCardUrl, agent);

          return Promise.resolve({
            agentCardUrl: agent.agentCardUrl,
            displayName: agent.displayName,
            id: agent.id,
            providerOrganization: agent.providerOrganization,
            providerUrl: agent.providerUrl,
          });
        },
      },
    },
    bazaarRepositories: {
      linkEdges: {
        findByPath: (input) =>
          Promise.resolve(
            linkEdgeMap.get(
              `${input.kind}:${input.sourceNodeKind}:${input.sourceNodeId}:${input.targetNodeKind}:${input.targetNodeId}`,
            ) ?? null,
          ),
        upsert: (input) => {
          const record = {
            confidenceScore: input.confidenceScore,
            confidenceTier: input.confidenceTier,
            evidenceCount: input.evidenceCount,
            id: `edge:${input.sourceNodeId}:${input.targetNodeId}`,
            kind: input.kind,
            sourceNodeId: input.sourceNodeId,
            sourceNodeKind: input.sourceNodeKind,
            targetNodeId: input.targetNodeId,
            targetNodeKind: input.targetNodeKind,
          } satisfies LinkEdgeRecord;
          linkEdgeMap.set(
            `${input.kind}:${input.sourceNodeKind}:${input.sourceNodeId}:${input.targetNodeKind}:${input.targetNodeId}`,
            record,
          );

          return Promise.resolve(record);
        },
      },
      services: {
        findByLocator: (locator) =>
          Promise.resolve(
            serviceRecordMap.get(
              `${locator.network}:${locator.resourceUrl}:${locator.scheme}`,
            ) ?? null,
          ),
        findByResourceUrl: (resourceUrl) =>
          Promise.resolve(
            Array.from(serviceRecordMap.values()).find(
              (service) => service.resourceUrl === resourceUrl,
            ) ?? null,
          ),
        upsert: (input) => {
          serviceMap.set(input.resourceUrl, {
            id: `service:${input.resourceUrl}`,
            network: input.network,
            payToAddress: input.payToWalletId,
            resourceUrl: input.resourceUrl,
            scheme: input.scheme,
          });
          const record = {
            ...input,
            id: `service:${input.resourceUrl}`,
          } satisfies ServiceRecord;
          serviceRecordMap.set(
            `${input.network}:${input.resourceUrl}:${input.scheme}`,
            record,
          );

          return Promise.resolve(record);
        },
      },
      wallets: {
        findByAddressAndNetwork: (address, network) =>
          Promise.resolve({
            address,
            id: `wallet:${network}:${address}`,
            network,
          }),
        upsert: (input) =>
          Promise.resolve({
            address: input.address,
            id: `wallet:${input.network}:${input.address}`,
            network: input.network,
          }),
      },
    },
    listLinkableState: () =>
      Promise.resolve({
        agents: Array.from(agentMap.values()),
        services: Array.from(serviceMap.values()),
      }),
    listMetricInputs: () => Promise.resolve([]),
    metricsRepository: {
      findByAgentAndService: (agentId, serviceId) =>
        Promise.resolve(
          metricsMap.get(`${agentId}:${serviceId}`) ?? null,
        ),
      upsert: (input) => {
        const record = {
          ...input,
        } satisfies ObservableMetricsRecord;
        metricsMap.set(`${input.agentId}:${input.serviceId}`, record);

        return Promise.resolve(record);
      },
    },
    now: () => new Date("2026-03-13T00:00:00.000Z"),
  };
};

export const runWorkerJob = async (
  payload: WorkerJobPayload,
  dependencies: WorkerDependencies,
): Promise<WorkerRunResult> => {
  const parsed = workerJobPayloadSchema.parse(payload);
  const stages = toStageSet(parsed.stages);
  const completedAt = dependencies.now?.() ?? new Date();
  let a2a = emptyStageSummary(true);
  let bazaar = emptyStageSummary(true);
  let linking = emptyStageSummary(true);
  let metrics = emptyMetricsStageSummary(true);

  if (stages.has("a2a") && parsed.agentDomains && parsed.agentDomains.length > 0) {
    const ingested = await ingestAgentCards(
      parsed.agentDomains,
      dependencies.a2aIngestionOptions,
    );
    const persistedActions = await Promise.all(
      ingested
        .filter((result) => result.validationStatus === "validated")
        .map((result) => persistIngestedAgentCard(result, dependencies.a2aRepositories)),
    );
    a2a = countActions(persistedActions.map((result) => result.action));
  }

  if (stages.has("bazaar") && parsed.facilitatorBaseUrl) {
    const ingested = await ingestBazaarResourceRecords(
      parsed.facilitatorBaseUrl,
      dependencies.bazaarIngestionOptions,
    );
    const persisted = await persistBazaarResources(
      ingested.map((record) =>
        toPersistableBazaarResource(record.rawSourcePayload, record.normalized),
      ),
      dependencies.bazaarRepositories,
    );
    bazaar = countActions(persisted.map((result) => result.action));
  }

  if (stages.has("linking")) {
    const snapshot = await dependencies.listLinkableState();
    const links = linkAgentsToServices(
      snapshot.agents,
      snapshot.services,
      dependencies.linkingOptions,
    );
    const persisted = await Promise.all(
      links.map((link) =>
        persistAgentServiceLink(link, dependencies.bazaarRepositories.linkEdges),
      ),
    );
    linking = countActions(persisted.map((result) => result.action));
  }

  if (stages.has("metrics")) {
    const metricInputs = await dependencies.listMetricInputs(completedAt);
    const persistedMetrics = await Promise.all(
      metricInputs.map(async (input) => {
        const metricsRecord = computeMetrics({
          agentId: input.agentId,
          now: completedAt,
          observations: input.observations,
          serviceId: input.serviceId,
        });
        const persisted = await persistComputedMetrics(
          metricsRecord,
          dependencies.metricsRepository,
        );
        const score = scoreReputation({
          agentId: input.agentId,
          evidenceTypes: input.evidenceTypes,
          metrics: metricsRecord,
          serviceId: input.serviceId,
        });

        return {
          action: persisted.action,
          score,
        };
      }),
    );
    metrics = {
      ...countActions(persistedMetrics.map((result) => result.action)),
      scores: persistedMetrics.map((result) => result.score),
    };
  }

  return {
    completedAt,
    jobKey: parsed.jobKey ?? null,
    stages: {
      a2a,
      bazaar,
      linking,
      metrics,
    },
  };
};
