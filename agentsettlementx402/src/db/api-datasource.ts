import type { DatabaseClient } from "./connection.js";
import * as schema from "./schema.js";
import { eq, desc } from "drizzle-orm";
import type {
  ApiDataSource,
  AgentRecordView,
  ServiceRecordView,
  DebugAgentRecordView,
  DebugServiceRecordView,
  PaginatedResult,
  PaginationQuery,
  GraphData,
  DashboardStats,
  TimelineDataPoint,
  TopAgent,
} from "../api/app.js";
import type { ObservableMetrics } from "../metrics/observable.js";
import { scoreReputation, type ReputationScoreResult } from "../scoring/reputation.js";
import {
  fetchGraphData,
  fetchDashboardStats,
  fetchTimelineData,
  fetchTopAgents,
} from "./graph-queries.js";

export const createDatabaseApiDataSource = (
  db: DatabaseClient,
): ApiDataSource => {
  return {
    async getAgentById(id: string): Promise<AgentRecordView | null> {
      const [agent] = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.id, id))
        .limit(1);

      if (!agent) {
        return null;
      }

      return {
        id: agent.id,
        agentCardUrl: agent.agentCardUrl,
        displayName: agent.displayName,
        providerOrganization: agent.providerOrganization,
        providerUrl: agent.providerUrl,
      };
    },

    async getDebugAgentById(id: string): Promise<DebugAgentRecordView | null> {
      const agent = await this.getAgentById(id);

      if (!agent) {
        return null;
      }

      const [agentCard] = await db
        .select()
        .from(schema.agentCards)
        .where(eq(schema.agentCards.agentId, id))
        .limit(1);

      return {
        ...agent,
        debug: {
          agentCard: agentCard
            ? {
                normalizedJson: agentCard.normalizedJson,
                rawJson: agentCard.rawJson,
                rawJsonHash: agentCard.rawJsonHash,
                signatureVerificationStatus:
                  agentCard.signatureVerificationStatus,
              }
            : null,
        },
      };
    },

    async getServiceById(id: string): Promise<ServiceRecordView | null> {
      const [service] = await db
        .select()
        .from(schema.services)
        .innerJoin(schema.wallets, eq(schema.services.payToWalletId, schema.wallets.id))
        .where(eq(schema.services.id, id))
        .limit(1);

      if (!service) {
        return null;
      }

      return {
        id: service.services.id,
        resourceUrl: service.services.resourceUrl,
        payToWalletId: service.wallets.address,
        network: service.services.network,
        scheme: service.services.scheme,
        asset: service.services.asset,
        amount: service.services.amount,
        mimeType: service.services.mimeType,
        description: service.services.description,
        inputSchemaUrl: service.services.inputSchemaUrl,
        outputSchemaUrl: service.services.outputSchemaUrl,
        schemaId: service.services.schemaId,
      };
    },

    async getDebugServiceById(id: string): Promise<DebugServiceRecordView | null> {
      const service = await this.getServiceById(id);

      if (!service) {
        return null;
      }

      const [serviceData] = await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, id))
        .limit(1);

      if (!serviceData) {
        return null;
      }

      return {
        ...service,
        debug: {
          rawSourceJson: serviceData.rawSourceJson,
          sourceFingerprint: serviceData.sourceFingerprint,
        },
      };
    },

    async listAgents(
      pagination: PaginationQuery,
    ): Promise<PaginatedResult<AgentRecordView>> {
      const offset = (pagination.page - 1) * pagination.pageSize;

      const items = await db
        .select()
        .from(schema.agents)
        .orderBy(desc(schema.agents.createdAt))
        .limit(pagination.pageSize)
        .offset(offset);

      const [countResult] = await db
        .select({ count: schema.agents.id })
        .from(schema.agents);

      const total = items.length;

      return {
        items: items.map((agent) => ({
          id: agent.id,
          agentCardUrl: agent.agentCardUrl,
          displayName: agent.displayName,
          providerOrganization: agent.providerOrganization,
          providerUrl: agent.providerUrl,
        })),
        total,
      };
    },

    async listServices(
      pagination: PaginationQuery,
    ): Promise<PaginatedResult<ServiceRecordView>> {
      const offset = (pagination.page - 1) * pagination.pageSize;

      const results = await db
        .select()
        .from(schema.services)
        .innerJoin(schema.wallets, eq(schema.services.payToWalletId, schema.wallets.id))
        .orderBy(desc(schema.services.createdAt))
        .limit(pagination.pageSize)
        .offset(offset);

      const [countResult] = await db
        .select({ count: schema.services.id })
        .from(schema.services);

      const total = results.length;

      return {
        items: results.map((result) => ({
          id: result.services.id,
          resourceUrl: result.services.resourceUrl,
          payToWalletId: result.wallets.address,
          network: result.services.network,
          scheme: result.services.scheme,
          asset: result.services.asset,
          amount: result.services.amount,
          mimeType: result.services.mimeType,
          description: result.services.description,
          inputSchemaUrl: result.services.inputSchemaUrl,
          outputSchemaUrl: result.services.outputSchemaUrl,
          schemaId: result.services.schemaId,
        })),
        total,
      };
    },

    async getMetricsByAgentId(id: string): Promise<ObservableMetrics | null> {
      const [result] = await db
        .select()
        .from(schema.observableMetrics)
        .where(eq(schema.observableMetrics.agentId, id))
        .limit(1);

      if (!result) {
        return null;
      }

      return {
        agentId: result.agentId,
        serviceId: result.serviceId,
        asOf: result.asOf,
        usage: result.usage as ObservableMetrics["usage"],
        success: result.success as ObservableMetrics["success"],
        recency: result.recency as ObservableMetrics["recency"],
        derivedProxies: result.derivedProxies as ObservableMetrics["derivedProxies"],
      };
    },

    async getReputationByAgentId(
      id: string,
    ): Promise<ReputationScoreResult | null> {
      const metrics = await this.getMetricsByAgentId(id);
      if (!metrics) {
        return null;
      }

      return scoreReputation({
        agentId: id,
        serviceId: metrics.serviceId,
        metrics,
        evidenceTypes: ["bazaar_declaration"],
      });
    },

    async getGraphData(): Promise<GraphData> {
      return fetchGraphData(db);
    },

    async getDashboardStats(): Promise<DashboardStats> {
      return fetchDashboardStats(db);
    },

    async getTimelineData(days: number): Promise<readonly TimelineDataPoint[]> {
      return fetchTimelineData(db, days);
    },

    async getTopAgents(limit: number): Promise<readonly TopAgent[]> {
      return fetchTopAgents(db, limit);
    },
  };
};
