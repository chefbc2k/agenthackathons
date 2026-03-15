import { eq, and } from "drizzle-orm";
import type { DatabaseClient } from "./connection.js";
import * as schema from "./schema.js";
import type {
  AgentRepository,
  AgentCardRepository,
  WalletRepository,
  ServiceRepository,
  LinkEdgeRepository,
  ObservableMetricsRepository,
  PaymentEventRepository,
  CreateAgentInput,
  UpsertAgentCardInput,
  CreateWalletInput,
  UpsertServiceInput,
  ServiceLocator,
  UpsertLinkEdgeInput,
  UpsertObservableMetricsInput,
  CreatePaymentEventInput,
  AgentRecord,
  AgentCardRecord,
  WalletRecord,
  ServiceRecord,
  LinkEdgeRecord,
  ObservableMetricsRecord,
  PaymentEventRecord,
} from "./repositories.js";

export const createAgentRepository = (db: DatabaseClient): AgentRepository => {
  return {
    async create(input: CreateAgentInput): Promise<AgentRecord> {
      const [result] = await db
        .insert(schema.agents)
        .values(input)
        .returning();
      return result!;
    },

    async findByAgentCardUrl(agentCardUrl: string): Promise<AgentRecord | null> {
      const [result] = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.agentCardUrl, agentCardUrl))
        .limit(1);
      return result ?? null;
    },

    async upsert(input: CreateAgentInput): Promise<AgentRecord> {
      const existing = await this.findByAgentCardUrl(input.agentCardUrl);

      if (existing) {
        const [updated] = await db
          .update(schema.agents)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(schema.agents.id, existing.id))
          .returning();
        return updated!;
      }

      return this.create(input);
    },
  };
};

export const createAgentCardRepository = (
  db: DatabaseClient,
): AgentCardRepository => {
  return {
    async findByAgentId(agentId: string): Promise<AgentCardRecord | null> {
      const [result] = await db
        .select()
        .from(schema.agentCards)
        .where(eq(schema.agentCards.agentId, agentId))
        .limit(1);
      return result ?? null;
    },

    async upsert(input: UpsertAgentCardInput): Promise<AgentCardRecord> {
      const existing = await this.findByAgentId(input.agentId);

      if (existing) {
        const [updated] = await db
          .update(schema.agentCards)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(schema.agentCards.id, existing.id))
          .returning();
        return updated!;
      }

      const [created] = await db
        .insert(schema.agentCards)
        .values(input)
        .returning();
      return created!;
    },
  };
};

export const createWalletRepository = (db: DatabaseClient): WalletRepository => {
  return {
    async findByAddressAndNetwork(
      address: string,
      network: string,
    ): Promise<WalletRecord | null> {
      const [result] = await db
        .select()
        .from(schema.wallets)
        .where(
          and(
            eq(schema.wallets.address, address),
            eq(schema.wallets.network, network),
          ),
        )
        .limit(1);
      return result ?? null;
    },

    async upsert(input: CreateWalletInput): Promise<WalletRecord> {
      const [result] = await db
        .insert(schema.wallets)
        .values(input)
        .onConflictDoNothing({
          target: [schema.wallets.address, schema.wallets.network],
        })
        .returning();

      // If insert was skipped due to conflict, fetch the existing record
      if (!result) {
        const existing = await this.findByAddressAndNetwork(
          input.address,
          input.network,
        );
        return existing!;
      }

      return result;
    },
  };
};

export const createServiceRepository = (
  db: DatabaseClient,
): ServiceRepository => {
  return {
    async findByResourceUrl(resourceUrl: string): Promise<ServiceRecord | null> {
      const [result] = await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.resourceUrl, resourceUrl))
        .limit(1);
      return result ?? null;
    },

    async findByLocator(locator: ServiceLocator): Promise<ServiceRecord | null> {
      const [result] = await db
        .select()
        .from(schema.services)
        .where(
          and(
            eq(schema.services.resourceUrl, locator.resourceUrl),
            eq(schema.services.network, locator.network),
            eq(schema.services.scheme, locator.scheme),
          ),
        )
        .limit(1);
      return result ?? null;
    },

    async upsert(input: UpsertServiceInput): Promise<ServiceRecord> {
      const locator: ServiceLocator = {
        resourceUrl: input.resourceUrl,
        network: input.network,
        scheme: input.scheme,
      };
      const existing = await this.findByLocator(locator);

      if (existing) {
        const [updated] = await db
          .update(schema.services)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(schema.services.id, existing.id))
          .returning();
        return updated!;
      }

      const [created] = await db
        .insert(schema.services)
        .values(input)
        .returning();
      return created!;
    },
  };
};

export const createLinkEdgeRepository = (
  db: DatabaseClient,
): LinkEdgeRepository => {
  return {
    async findByPath(
      input: Omit<
        UpsertLinkEdgeInput,
        "confidenceTier" | "confidenceScore" | "evidenceCount"
      >,
    ): Promise<LinkEdgeRecord | null> {
      const [result] = await db
        .select()
        .from(schema.linkEdges)
        .where(
          and(
            eq(schema.linkEdges.kind, input.kind),
            eq(schema.linkEdges.sourceNodeKind, input.sourceNodeKind),
            eq(schema.linkEdges.sourceNodeId, input.sourceNodeId),
            eq(schema.linkEdges.targetNodeKind, input.targetNodeKind),
            eq(schema.linkEdges.targetNodeId, input.targetNodeId),
          ),
        )
        .limit(1);
      return result ?? null;
    },

    async upsert(input: UpsertLinkEdgeInput): Promise<LinkEdgeRecord> {
      const existing = await this.findByPath(input);

      if (existing) {
        const [updated] = await db
          .update(schema.linkEdges)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(schema.linkEdges.id, existing.id))
          .returning();
        return updated!;
      }

      const [created] = await db
        .insert(schema.linkEdges)
        .values(input)
        .returning();
      return created!;
    },
  };
};

export const createObservableMetricsRepository = (
  db: DatabaseClient,
): ObservableMetricsRepository => {
  return {
    async findByAgentAndService(
      agentId: string,
      serviceId: string,
    ): Promise<ObservableMetricsRecord | null> {
      const [result] = await db
        .select()
        .from(schema.observableMetrics)
        .where(
          and(
            eq(schema.observableMetrics.agentId, agentId),
            eq(schema.observableMetrics.serviceId, serviceId),
          ),
        )
        .limit(1);
      return result ?? null;
    },

    async upsert(
      input: UpsertObservableMetricsInput,
    ): Promise<ObservableMetricsRecord> {
      const existing = await this.findByAgentAndService(
        input.agentId,
        input.serviceId,
      );

      if (existing) {
        const [updated] = await db
          .update(schema.observableMetrics)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(schema.observableMetrics.id, existing.id))
          .returning();
        return updated!;
      }

      const [created] = await db
        .insert(schema.observableMetrics)
        .values(input)
        .returning();
      return created!;
    },
  };
};

export const createPaymentEventRepository = (
  db: DatabaseClient,
): PaymentEventRepository => {
  return {
    async create(input: CreatePaymentEventInput): Promise<PaymentEventRecord> {
      const [result] = await db
        .insert(schema.paymentEvents)
        .values(input)
        .returning();
      return result!;
    },

    async findBySourceReference(
      source: string,
      sourceReference: string,
    ): Promise<PaymentEventRecord | null> {
      const [result] = await db
        .select()
        .from(schema.paymentEvents)
        .where(
          and(
            eq(schema.paymentEvents.source, source),
            eq(schema.paymentEvents.sourceReference, sourceReference),
          ),
        )
        .limit(1);
      return result ?? null;
    },

    async findByTxHash(
      txHash: string,
      network: string,
    ): Promise<PaymentEventRecord | null> {
      const [result] = await db
        .select()
        .from(schema.paymentEvents)
        .where(
          and(
            eq(schema.paymentEvents.txHash, txHash),
            eq(schema.paymentEvents.network, network),
          ),
        )
        .limit(1);
      return result ?? null;
    },
  };
};
