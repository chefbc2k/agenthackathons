import type { DatabaseClient } from "./connection.js";
import * as schema from "./schema.js";
import { eq, desc, and, sql } from "drizzle-orm";
import type { WorkerDependencies, WorkerStateSnapshot, WorkerMetricsInput } from "../worker/orchestrator.js";
import type { LinkableAgent, LinkableService } from "../linking/agent-service.js";
import {
  createAgentRepository,
  createAgentCardRepository,
  createWalletRepository,
  createServiceRepository,
  createLinkEdgeRepository,
  createObservableMetricsRepository,
} from "./implementations.js";

export const createDatabaseWorkerDependencies = (
  db: DatabaseClient,
): WorkerDependencies => {
  const agentRepo = createAgentRepository(db);
  const agentCardRepo = createAgentCardRepository(db);
  const walletRepo = createWalletRepository(db);
  const serviceRepo = createServiceRepository(db);
  const linkEdgeRepo = createLinkEdgeRepository(db);
  const metricsRepo = createObservableMetricsRepository(db);

  return {
    a2aRepositories: {
      agents: agentRepo,
      agentCards: agentCardRepo,
    },
    bazaarRepositories: {
      services: serviceRepo,
      wallets: walletRepo,
      linkEdges: linkEdgeRepo,
    },
    metricsRepository: metricsRepo,

    async listLinkableState(): Promise<WorkerStateSnapshot> {
      // Fetch all agents
      const agents = await db
        .select()
        .from(schema.agents)
        .orderBy(desc(schema.agents.createdAt));

      // Fetch all services with wallet info
      const servicesWithWallets = await db
        .select()
        .from(schema.services)
        .innerJoin(schema.wallets, eq(schema.services.payToWalletId, schema.wallets.id))
        .orderBy(desc(schema.services.createdAt));

      const linkableAgents: LinkableAgent[] = agents.map((agent) => ({
        id: agent.id,
        agentCardUrl: agent.agentCardUrl,
        displayName: agent.displayName,
        providerOrganization: agent.providerOrganization,
        providerUrl: agent.providerUrl,
        declaredServiceBindings: [],
        signatureVerificationStatus: "unverified",
      }));

      const linkableServices: LinkableService[] = servicesWithWallets.map((item) => ({
        id: item.services.id,
        resourceUrl: item.services.resourceUrl,
        network: item.services.network,
        scheme: item.services.scheme,
        payToWalletAddress: item.wallets.address,
        payToWalletNetwork: item.wallets.network,
      }));

      return {
        agents: linkableAgents,
        services: linkableServices,
      };
    },

    async listMetricInputs(_asOf: Date): Promise<readonly WorkerMetricsInput[]> {
      // For now, return empty array - metrics computation would need payment event data
      return [];
    },
  };
};
