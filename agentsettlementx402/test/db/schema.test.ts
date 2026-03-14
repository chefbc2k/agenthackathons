import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  agentCards,
  agents,
  attemptGroups,
  buildAgentIndexes,
  buildAgentCardIndexes,
  confidenceTierEnum,
  linkEdgeKindEnum,
  linkEdgeNodeKindEnum,
  linkEdges,
  observableMetrics,
  paymentEventSourceEnum,
  paymentEvents,
  referenceAgentId,
  referenceAgentTableId,
  referenceObservableMetricsAgentId,
  referenceObservableMetricsServiceId,
  referenceAttemptGroupId,
  referenceServiceWalletId,
  referenceServiceId,
  referenceWalletId,
  serviceAgents,
  services,
  signatureVerificationStatusEnum,
  wallets,
} from "../../src/db/schema.js";

const drizzleNameSymbol = Symbol.for("drizzle:Name");

const getDrizzleTableName = (table: object): string => {
  return (table as { [drizzleNameSymbol]: string })[drizzleNameSymbol];
};

describe("db schema exports", () => {
  it("defines the expected enums", () => {
    expect(confidenceTierEnum.enumName).toBe("confidence_tier");
    expect(confidenceTierEnum.enumValues).toEqual([
      "low",
      "medium",
      "high",
      "verified",
    ]);
    expect(signatureVerificationStatusEnum.enumValues).toEqual([
      "unverified",
      "verified",
      "failed",
      "unsupported",
    ]);
    expect(paymentEventSourceEnum.enumValues).toEqual([
      "bazaar",
      "payment_required",
      "settlement_receipt",
      "manual",
    ]);
    expect(linkEdgeKindEnum.enumValues).toContain("agent_to_service");
    expect(linkEdgeNodeKindEnum.enumValues).toContain("wallet");
  });

  it("defines graph tables with stable table names", () => {
    expect(getDrizzleTableName(agents)).toBe("agents");
    expect(getDrizzleTableName(agentCards)).toBe("agent_cards");
    expect(getDrizzleTableName(services)).toBe("services");
    expect(getDrizzleTableName(wallets)).toBe("wallets");
    expect(getDrizzleTableName(paymentEvents)).toBe("payment_events");
    expect(getDrizzleTableName(attemptGroups)).toBe("attempt_groups");
    expect(getDrizzleTableName(linkEdges)).toBe("link_edges");
    expect(getDrizzleTableName(observableMetrics)).toBe("observable_metrics");
    expect(getDrizzleTableName(serviceAgents)).toBe("service_agents");
  });

  it("defines expected key columns", () => {
    expect(agents.id.name).toBe("id");
    expect(agents.agentCardUrl.name).toBe("agent_card_url");
    expect(agentCards.signatureVerificationStatus.name).toBe(
      "signature_verification_status",
    );
    expect(agentCards.rawJsonHash.name).toBe("raw_json_hash");
    expect(services.resourceUrl.name).toBe("resource_url");
    expect(services.rawSourceJson.name).toBe("raw_source_json");
    expect(services.sourceFingerprint.name).toBe("source_fingerprint");
    expect(wallets.address.name).toBe("address");
    expect(paymentEvents.txHash.name).toBe("tx_hash");
    expect(paymentEvents.confidenceScore.name).toBe("confidence_score");
    expect(attemptGroups.paymentIdentifier.name).toBe("payment_identifier");
    expect(linkEdges.sourceNodeKind.name).toBe("source_node_kind");
    expect(observableMetrics.metricsFingerprint.name).toBe("metrics_fingerprint");
    expect(serviceAgents.agentId.name).toBe("agent_id");
  });

  it("materializes indexes, foreign keys, and composite keys for graph relationships", () => {
    const paymentEventConfig = getTableConfig(paymentEvents);
    const linkEdgeConfig = getTableConfig(linkEdges);
    const observableMetricsConfig = getTableConfig(observableMetrics);
    const serviceAgentConfig = getTableConfig(serviceAgents);
    const serviceConfig = getTableConfig(services);

    expect(paymentEventConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "payment_events_tx_hash_network_unique",
        "payment_events_attempt_group_idx",
        "payment_events_payto_idx",
      ]),
    );
    expect(paymentEventConfig.checks).toHaveLength(1);
    expect(paymentEventConfig.foreignKeys).toHaveLength(3);

    expect(linkEdgeConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "link_edges_unique_path",
        "link_edges_source_idx",
        "link_edges_target_idx",
      ]),
    );
    expect(linkEdgeConfig.checks).toHaveLength(1);

    expect(serviceAgentConfig.primaryKeys.map((key) => key.getName())).toEqual([
      "service_agents_pk",
    ]);
    expect(serviceAgentConfig.foreignKeys).toHaveLength(2);

    expect(serviceConfig.foreignKeys).toHaveLength(1);
    expect(observableMetricsConfig.foreignKeys).toHaveLength(2);
  });

  it("binds foreign-key reference callbacks to the expected target columns", () => {
    const paymentEventAttemptRef = referenceAttemptGroupId();
    const paymentEventPayerRef = referenceWalletId();
    const paymentEventPayToRef = referenceWalletId();
    const agentCardAgentRef = referenceAgentTableId();
    const serviceWalletRef = referenceServiceWalletId();
    const serviceAgentServiceRef = referenceServiceId();
    const serviceAgentAgentRef = referenceAgentId();
    const observableMetricsAgentRef = referenceObservableMetricsAgentId();
    const observableMetricsServiceRef = referenceObservableMetricsServiceId();

    expect(paymentEventAttemptRef.name).toBe("id");
    expect(paymentEventPayerRef.name).toBe("id");
    expect(paymentEventPayToRef.name).toBe("id");
    expect(agentCardAgentRef.name).toBe("id");
    expect(serviceWalletRef.name).toBe("id");
    expect(serviceAgentServiceRef.name).toBe("id");
    expect(serviceAgentAgentRef.name).toBe("id");
    expect(observableMetricsAgentRef.name).toBe("id");
    expect(observableMetricsServiceRef.name).toBe("id");
  });

  it("materializes index builders for all remaining tables", () => {
    const agentConfig = getTableConfig(agents);
    const agentCardConfig = getTableConfig(agentCards);
    const serviceConfig = getTableConfig(services);
    const walletConfig = getTableConfig(wallets);
    const attemptGroupConfig = getTableConfig(attemptGroups);
    const observableMetricsConfig = getTableConfig(observableMetrics);

    expect(buildAgentIndexes).toBeTypeOf("function");
    expect(buildAgentCardIndexes).toBeTypeOf("function");
    expect(
      agentConfig.uniqueConstraints.map((constraint) => constraint.name),
    ).toEqual(["agents_agent_card_url_provider_identity_unique"]);
    expect(agentConfig.indexes.map((index) => index.config.name)).toEqual([
      "agents_agent_card_url_unique",
      "agents_provider_lookup_idx",
      "agents_display_name_idx",
    ]);
    expect(agentCardConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "agent_cards_agent_id_unique",
        "agent_cards_raw_json_hash_idx",
        "agent_cards_signature_status_idx",
      ]),
    );
    expect(
      serviceConfig.indexes.map((index) => index.config.name),
    ).toEqual(
      expect.arrayContaining([
        "services_resource_locator_unique",
        "services_wallet_network_idx",
        "services_source_fingerprint_idx",
      ]),
    );
    expect(walletConfig.indexes.map((index) => index.config.name)).toEqual([
      "wallets_address_network_unique",
    ]);
    expect(
      attemptGroupConfig.indexes.map((index) => index.config.name),
    ).toEqual(["attempt_groups_payment_identifier_unique"]);
    expect(
      observableMetricsConfig.indexes.map((index) => index.config.name),
    ).toEqual(
      expect.arrayContaining([
        "observable_metrics_agent_service_unique",
        "observable_metrics_asof_idx",
        "observable_metrics_fingerprint_idx",
      ]),
    );
  });
});
