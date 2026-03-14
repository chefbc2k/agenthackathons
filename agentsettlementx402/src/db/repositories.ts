import type {
  ConfidenceTier,
  LinkEdgeKind,
  LinkEdgeNodeKind,
  PaymentEventSource,
  SignatureVerificationStatus,
} from "./schema.js";

export const repositoryContractNames = [
  "agents",
  "agentCards",
  "wallets",
  "services",
  "attemptGroups",
  "paymentEvents",
  "linkEdges",
  "observableMetrics",
] as const;

export const graphNodeKinds = [
  "agent",
  "agent_card",
  "service",
  "wallet",
  "payment_event",
  "attempt_group",
] as const;

export interface AgentRecord {
  readonly id: string;
  readonly agentCardUrl: string;
  readonly createdAt?: Date;
  readonly providerOrganization: string | null;
  readonly providerUrl: string | null;
  readonly displayName: string;
  readonly updatedAt?: Date;
}

export interface CreateAgentInput {
  readonly agentCardUrl: string;
  readonly providerOrganization: string | null;
  readonly providerUrl: string | null;
  readonly displayName: string;
}

export interface AgentCardRecord {
  readonly id: string;
  readonly agentId: string;
  readonly createdAt?: Date;
  readonly discoveredAt?: Date;
  readonly rawJson: unknown;
  readonly rawJsonHash: string;
  readonly normalizedJson: unknown;
  readonly documentationUrl: string | null;
  readonly description: string | null;
  readonly signatureVerificationStatus: SignatureVerificationStatus;
  readonly updatedAt?: Date;
}

export interface UpsertAgentCardInput {
  readonly agentId: string;
  readonly rawJson: unknown;
  readonly rawJsonHash: string;
  readonly normalizedJson: unknown;
  readonly documentationUrl: string | null;
  readonly description: string | null;
  readonly signatureVerificationStatus: SignatureVerificationStatus;
}

export interface WalletRecord {
  readonly id: string;
  readonly address: string;
  readonly network: string;
}

export interface CreateWalletInput {
  readonly address: string;
  readonly network: string;
}

export interface ServiceRecord {
  readonly id: string;
  readonly resourceUrl: string;
  readonly payToWalletId: string;
  readonly network: string;
  readonly scheme: string;
  readonly asset: string | null;
  readonly amount: string | null;
  readonly mimeType: string | null;
  readonly description: string | null;
  readonly inputSchemaUrl: string | null;
  readonly outputSchemaUrl: string | null;
  readonly schemaId: string | null;
  readonly rawSourceJson: unknown;
  readonly sourceFingerprint: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface UpsertServiceInput {
  readonly resourceUrl: string;
  readonly payToWalletId: string;
  readonly network: string;
  readonly scheme: string;
  readonly asset: string | null;
  readonly amount: string | null;
  readonly mimeType: string | null;
  readonly description: string | null;
  readonly inputSchemaUrl: string | null;
  readonly outputSchemaUrl: string | null;
  readonly schemaId: string | null;
  readonly rawSourceJson: unknown;
  readonly sourceFingerprint: string;
}

export interface ServiceLocator {
  readonly resourceUrl: string;
  readonly network: string;
  readonly scheme: string;
}

export interface AttemptGroupRecord {
  readonly id: string;
  readonly paymentIdentifier: string;
}

export interface CreateAttemptGroupInput {
  readonly paymentIdentifier: string;
}

export interface PaymentEventRecord {
  readonly id: string;
  readonly attemptGroupId: string | null;
  readonly payerWalletId: string | null;
  readonly payToWalletId: string;
  readonly txHash: string;
  readonly network: string;
  readonly asset: string;
  readonly amount: string;
  readonly observedAt: Date;
  readonly confidenceTier: ConfidenceTier;
  readonly confidenceScore: number;
  readonly source: PaymentEventSource;
  readonly sourceReference: string | null;
}

export interface CreatePaymentEventInput {
  readonly attemptGroupId: string | null;
  readonly payerWalletId: string | null;
  readonly payToWalletId: string;
  readonly txHash: string;
  readonly network: string;
  readonly asset: string;
  readonly amount: string;
  readonly observedAt: Date;
  readonly confidenceTier: ConfidenceTier;
  readonly confidenceScore: number;
  readonly source: PaymentEventSource;
  readonly sourceReference: string | null;
}

export interface LinkEdgeRecord {
  readonly id: string;
  readonly kind: LinkEdgeKind;
  readonly sourceNodeKind: LinkEdgeNodeKind;
  readonly sourceNodeId: string;
  readonly targetNodeKind: LinkEdgeNodeKind;
  readonly targetNodeId: string;
  readonly confidenceTier: ConfidenceTier;
  readonly confidenceScore: number;
  readonly evidenceCount: number;
}

export interface UpsertLinkEdgeInput {
  readonly kind: LinkEdgeKind;
  readonly sourceNodeKind: LinkEdgeNodeKind;
  readonly sourceNodeId: string;
  readonly targetNodeKind: LinkEdgeNodeKind;
  readonly targetNodeId: string;
  readonly confidenceTier: ConfidenceTier;
  readonly confidenceScore: number;
  readonly evidenceCount: number;
}

export interface ObservableUsageMetricsRecord {
  readonly eventCount: number;
  readonly uniquePayerCount: number;
}

export interface ObservableRecencyMetricsRecord {
  readonly eventCount7d: number;
  readonly eventCount30d: number;
  readonly uniquePayerCount7d: number;
  readonly uniquePayerCount30d: number;
}

export interface ObservableSuccessMetricsRecord {
  readonly failureCount: number;
  readonly observableAttemptCount: number;
  readonly successCount: number;
  readonly successRate: number | null;
}

export interface ObservableRetryProxyMetricsRecord {
  readonly attemptsWithGroupKey: number;
  readonly averageAttemptsPerGroup: number | null;
  readonly groupedAttemptCount: number;
  readonly groupsWithRetries: number;
}

export interface ObservableMetricsRecord {
  readonly agentId: string;
  readonly asOf: Date;
  readonly createdAt?: Date;
  readonly derivedProxies: {
    readonly retryIntensity: ObservableRetryProxyMetricsRecord;
  };
  readonly metricsFingerprint: string;
  readonly recency: ObservableRecencyMetricsRecord;
  readonly serviceId: string;
  readonly success: ObservableSuccessMetricsRecord;
  readonly updatedAt?: Date;
  readonly usage: ObservableUsageMetricsRecord;
}

export interface UpsertObservableMetricsInput {
  readonly agentId: string;
  readonly asOf: Date;
  readonly derivedProxies: {
    readonly retryIntensity: ObservableRetryProxyMetricsRecord;
  };
  readonly metricsFingerprint: string;
  readonly recency: ObservableRecencyMetricsRecord;
  readonly serviceId: string;
  readonly success: ObservableSuccessMetricsRecord;
  readonly usage: ObservableUsageMetricsRecord;
}

export interface AgentRepository {
  create(input: CreateAgentInput): Promise<AgentRecord>;
  findByAgentCardUrl(agentCardUrl: string): Promise<AgentRecord | null>;
  upsert(input: CreateAgentInput): Promise<AgentRecord>;
}

export interface AgentCardRepository {
  findByAgentId(agentId: string): Promise<AgentCardRecord | null>;
  upsert(input: UpsertAgentCardInput): Promise<AgentCardRecord>;
}

export interface WalletRepository {
  findByAddressAndNetwork(
    address: string,
    network: string,
  ): Promise<WalletRecord | null>;
  upsert(input: CreateWalletInput): Promise<WalletRecord>;
}

export interface ServiceRepository {
  findByResourceUrl(resourceUrl: string): Promise<ServiceRecord | null>;
  findByLocator(locator: ServiceLocator): Promise<ServiceRecord | null>;
  upsert(input: UpsertServiceInput): Promise<ServiceRecord>;
}

export interface AttemptGroupRepository {
  findByPaymentIdentifier(
    paymentIdentifier: string,
  ): Promise<AttemptGroupRecord | null>;
  upsert(input: CreateAttemptGroupInput): Promise<AttemptGroupRecord>;
}

export interface PaymentEventRepository {
  findByTransaction(
    txHash: string,
    network: string,
  ): Promise<PaymentEventRecord | null>;
  create(input: CreatePaymentEventInput): Promise<PaymentEventRecord>;
}

export interface LinkEdgeRepository {
  findByPath(
    input: Omit<
      UpsertLinkEdgeInput,
      "confidenceTier" | "confidenceScore" | "evidenceCount"
    >,
  ): Promise<LinkEdgeRecord | null>;
  upsert(input: UpsertLinkEdgeInput): Promise<LinkEdgeRecord>;
}

export interface ObservableMetricsRepository {
  findByAgentAndService(
    agentId: string,
    serviceId: string,
  ): Promise<ObservableMetricsRecord | null>;
  upsert(input: UpsertObservableMetricsInput): Promise<ObservableMetricsRecord>;
}
