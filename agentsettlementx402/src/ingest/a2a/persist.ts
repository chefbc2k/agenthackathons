import type {
  AgentCardRepository,
  AgentCardRecord,
  AgentRecord,
  AgentRepository,
} from "../../db/repositories.js";
import { hashStableJson } from "../../core/stable-json.js";
import type { AgentCardIngestionResult } from "./agent-cards.js";

export { hashStableJson } from "../../core/stable-json.js";

export class A2aPersistenceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "A2aPersistenceError";
  }
}

export interface A2aPersistenceRepositories {
  readonly agentCards: AgentCardRepository;
  readonly agents: AgentRepository;
}

export interface PersistedAgentCardResult {
  readonly action: "created" | "updated" | "noop";
  readonly agent: AgentRecord;
  readonly agentCard: AgentCardRecord;
  readonly rawJsonHash: string;
  readonly sourceUrl: string;
}

const ensurePersistableResult = (
  result: AgentCardIngestionResult,
): {
  readonly agentCardRecord: NonNullable<AgentCardIngestionResult["agentCard"]>;
  readonly agentIdentity: NonNullable<AgentCardIngestionResult["agent"]>;
} => {
  if (result.validationStatus !== "validated") {
    throw new A2aPersistenceError(
      `Cannot persist ingest result with status ${result.validationStatus}`,
    );
  }

  if (!result.agent || !result.agentCard) {
    throw new A2aPersistenceError(
      "Validated ingest result is missing agent or agent-card data",
    );
  }

  return {
    agentCardRecord: result.agentCard,
    agentIdentity: result.agent,
  };
};

export const persistIngestedAgentCard = async (
  result: AgentCardIngestionResult,
  repositories: A2aPersistenceRepositories,
): Promise<PersistedAgentCardResult> => {
  const { agentCardRecord, agentIdentity } = ensurePersistableResult(result);

  const rawJsonHash = hashStableJson(result.rawJson);
  const agent = await repositories.agents.upsert({
    agentCardUrl: agentIdentity.agentCardUrl,
    displayName: agentIdentity.displayName,
    providerOrganization: agentIdentity.providerOrganization,
    providerUrl: agentIdentity.providerUrl,
  });

  const existingAgentCard = await repositories.agentCards.findByAgentId(agent.id);

  if (existingAgentCard && existingAgentCard.rawJsonHash === rawJsonHash) {
    return {
      action: "noop",
      agent,
      agentCard: existingAgentCard,
      rawJsonHash,
      sourceUrl: result.sourceUrl,
    };
  }

  const agentCard = await repositories.agentCards.upsert({
    agentId: agent.id,
    description: agentCardRecord.description,
    documentationUrl: agentCardRecord.documentationUrl,
    normalizedJson: agentCardRecord.normalizedJson,
    rawJson: agentCardRecord.rawJson,
    rawJsonHash,
    signatureVerificationStatus: agentCardRecord.signatureVerificationStatus,
  });

  return {
    action: existingAgentCard ? "updated" : "created",
    agent,
    agentCard,
    rawJsonHash,
    sourceUrl: result.sourceUrl,
  };
};
