import {
  type AnyPgColumn,
  bigint,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const confidenceTierEnum = pgEnum("confidence_tier", [
  "low",
  "medium",
  "high",
  "verified",
]);

export const signatureVerificationStatusEnum = pgEnum(
  "signature_verification_status",
  ["unverified", "verified", "failed", "unsupported"],
);

export const paymentEventSourceEnum = pgEnum("payment_event_source", [
  "bazaar",
  "payment_required",
  "settlement_receipt",
  "manual",
]);

export const linkEdgeKindEnum = pgEnum("link_edge_kind", [
  "agent_to_agent_card",
  "agent_to_service",
  "service_to_wallet",
  "payment_event_to_attempt_group",
  "wallet_to_payment_event",
]);

export const linkEdgeNodeKindEnum = pgEnum("link_edge_node_kind", [
  "agent",
  "agent_card",
  "service",
  "wallet",
  "payment_event",
  "attempt_group",
]);

export const buildAgentIndexes = (table: {
  agentCardUrl: AnyPgColumn;
  displayName: AnyPgColumn;
  providerOrganization: AnyPgColumn;
  providerUrl: AnyPgColumn;
}) => {
  return [
    unique("agents_agent_card_url_provider_identity_unique").on(
      table.agentCardUrl,
      table.providerOrganization,
      table.providerUrl,
    ),
    uniqueIndex("agents_agent_card_url_unique").on(table.agentCardUrl),
    index("agents_provider_lookup_idx").on(
      table.providerOrganization,
      table.providerUrl,
    ),
    index("agents_display_name_idx").on(table.displayName),
  ];
};

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentCardUrl: text("agent_card_url").notNull(),
    providerOrganization: text("provider_organization"),
    providerUrl: text("provider_url"),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => buildAgentIndexes(table),
);

export const referenceAgentTableId = () => agents.id;
export const buildAgentCardIndexes = (table: {
  agentId: AnyPgColumn;
  rawJsonHash: AnyPgColumn;
  signatureVerificationStatus: AnyPgColumn;
}) => {
  return [
    uniqueIndex("agent_cards_agent_id_unique").on(table.agentId),
    index("agent_cards_raw_json_hash_idx").on(table.rawJsonHash),
    index("agent_cards_signature_status_idx").on(
      table.signatureVerificationStatus,
    ),
  ];
};

export const agentCards = pgTable(
  "agent_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .references(referenceAgentTableId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    rawJson: jsonb("raw_json").notNull(),
    rawJsonHash: text("raw_json_hash").notNull(),
    normalizedJson: jsonb("normalized_json").notNull(),
    documentationUrl: text("documentation_url"),
    description: text("description"),
    signatureVerificationStatus:
      signatureVerificationStatusEnum("signature_verification_status")
        .default("unverified")
        .notNull(),
    signatureVerifiedAt: timestamp("signature_verified_at", {
      withTimezone: true,
    }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => buildAgentCardIndexes(table),
);

export const buildWalletIndexes = (table: {
  address: AnyPgColumn;
  network: AnyPgColumn;
}) => {
  return [
    uniqueIndex("wallets_address_network_unique").on(
      table.address,
      table.network,
    ),
  ];
};

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    address: text("address").notNull(),
    network: text("network").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => buildWalletIndexes(table),
);

export const referenceServiceWalletId = () => wallets.id;
export const buildServiceIndexes = (table: {
  resourceUrl: AnyPgColumn;
  payToWalletId: AnyPgColumn;
  network: AnyPgColumn;
  scheme: AnyPgColumn;
  sourceFingerprint: AnyPgColumn;
}) => {
  return [
    uniqueIndex("services_resource_locator_unique").on(
      table.resourceUrl,
      table.network,
      table.scheme,
    ),
    index("services_wallet_network_idx").on(table.payToWalletId, table.network),
    index("services_source_fingerprint_idx").on(table.sourceFingerprint),
  ];
};

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceUrl: text("resource_url").notNull(),
    payToWalletId: uuid("pay_to_wallet_id")
      .references(referenceServiceWalletId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      })
      .notNull(),
    network: text("network").notNull(),
    scheme: text("scheme").notNull(),
    asset: text("asset"),
    amount: text("amount"),
    mimeType: text("mime_type"),
    description: text("description"),
    inputSchemaUrl: text("input_schema_url"),
    outputSchemaUrl: text("output_schema_url"),
    schemaId: text("schema_id"),
    rawSourceJson: jsonb("raw_source_json").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => buildServiceIndexes(table),
);

export const buildAttemptGroupIndexes = (
  table: {
    paymentIdentifier: AnyPgColumn;
  },
) => {
  return [
    uniqueIndex("attempt_groups_payment_identifier_unique").on(
      table.paymentIdentifier,
    ),
  ];
};

export const attemptGroups = pgTable(
  "attempt_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentIdentifier: text("payment_identifier").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => buildAttemptGroupIndexes(table),
);

export const referenceAttemptGroupId = () => attemptGroups.id;
export const referenceWalletId = () => wallets.id;
export const referenceServiceId = () => services.id;
export const referenceAgentId = () => agents.id;
export const buildPaymentEventIndexes = (
  table: {
    txHash: AnyPgColumn;
    network: AnyPgColumn;
    attemptGroupId: AnyPgColumn;
    payToWalletId: AnyPgColumn;
    confidenceScore: AnyPgColumn;
  },
) => {
  return [
    uniqueIndex("payment_events_tx_hash_network_unique").on(
      table.txHash,
      table.network,
    ),
    index("payment_events_attempt_group_idx").on(table.attemptGroupId),
    index("payment_events_payto_idx").on(table.payToWalletId, table.network),
    check(
      "payment_events_confidence_score_range_check",
      sql`${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 1000`,
    ),
  ];
};

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptGroupId: uuid("attempt_group_id").references(referenceAttemptGroupId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    payerWalletId: uuid("payer_wallet_id").references(referenceWalletId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    payToWalletId: uuid("pay_to_wallet_id")
      .references(referenceWalletId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      })
      .notNull(),
    txHash: text("tx_hash").notNull(),
    network: text("network").notNull(),
    asset: text("asset").notNull(),
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    blockNumber: bigint("block_number", { mode: "number" }),
    confidenceTier: confidenceTierEnum("confidence_tier")
      .default("medium")
      .notNull(),
    confidenceScore: integer("confidence_score").default(500).notNull(),
    source: paymentEventSourceEnum("source").notNull(),
    sourceReference: text("source_reference"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => buildPaymentEventIndexes(table),
);

export const buildLinkEdgeIndexes = (table: {
  kind: AnyPgColumn;
  sourceNodeKind: AnyPgColumn;
  sourceNodeId: AnyPgColumn;
  targetNodeKind: AnyPgColumn;
  targetNodeId: AnyPgColumn;
  confidenceScore: AnyPgColumn;
}) => {
  return [
    uniqueIndex("link_edges_unique_path").on(
      table.kind,
      table.sourceNodeKind,
      table.sourceNodeId,
      table.targetNodeKind,
      table.targetNodeId,
    ),
    index("link_edges_source_idx").on(table.sourceNodeKind, table.sourceNodeId),
    index("link_edges_target_idx").on(table.targetNodeKind, table.targetNodeId),
    check(
      "link_edges_confidence_score_range_check",
      sql`${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 1000`,
    ),
  ];
};

export const linkEdges = pgTable(
  "link_edges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: linkEdgeKindEnum("kind").notNull(),
    sourceNodeKind: linkEdgeNodeKindEnum("source_node_kind").notNull(),
    sourceNodeId: uuid("source_node_id").notNull(),
    targetNodeKind: linkEdgeNodeKindEnum("target_node_kind").notNull(),
    targetNodeId: uuid("target_node_id").notNull(),
    confidenceTier: confidenceTierEnum("confidence_tier")
      .default("medium")
      .notNull(),
    confidenceScore: integer("confidence_score").default(500).notNull(),
    evidenceCount: integer("evidence_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => buildLinkEdgeIndexes(table),
);

export const buildServiceAgentPrimaryKey = (
  table: {
    serviceId: AnyPgColumn;
    agentId: AnyPgColumn;
  },
) => {
  return [
    primaryKey({
      columns: [table.serviceId, table.agentId],
      name: "service_agents_pk",
    }),
  ];
};

export const serviceAgents = pgTable(
  "service_agents",
  {
    serviceId: uuid("service_id")
      .references(referenceServiceId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    agentId: uuid("agent_id")
      .references(referenceAgentId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => buildServiceAgentPrimaryKey(table),
);

export const referenceObservableMetricsAgentId = () => agents.id;
export const referenceObservableMetricsServiceId = () => services.id;
export const buildObservableMetricsIndexes = (table: {
  agentId: AnyPgColumn;
  asOf: AnyPgColumn;
  metricsFingerprint: AnyPgColumn;
  serviceId: AnyPgColumn;
}) => {
  return [
    uniqueIndex("observable_metrics_agent_service_unique").on(
      table.agentId,
      table.serviceId,
    ),
    index("observable_metrics_asof_idx").on(table.asOf),
    index("observable_metrics_fingerprint_idx").on(table.metricsFingerprint),
  ];
};

export const observableMetrics = pgTable(
  "observable_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .references(referenceObservableMetricsAgentId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    serviceId: uuid("service_id")
      .references(referenceObservableMetricsServiceId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    usage: jsonb("usage").notNull(),
    success: jsonb("success").notNull(),
    recency: jsonb("recency").notNull(),
    derivedProxies: jsonb("derived_proxies").notNull(),
    metricsFingerprint: text("metrics_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => buildObservableMetricsIndexes(table),
);

export type ConfidenceTier = (typeof confidenceTierEnum.enumValues)[number];
export type LinkEdgeKind = (typeof linkEdgeKindEnum.enumValues)[number];
export type LinkEdgeNodeKind =
  (typeof linkEdgeNodeKindEnum.enumValues)[number];
export type PaymentEventSource =
  (typeof paymentEventSourceEnum.enumValues)[number];
export type SignatureVerificationStatus =
  (typeof signatureVerificationStatusEnum.enumValues)[number];
