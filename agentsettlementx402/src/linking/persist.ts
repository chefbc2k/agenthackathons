import type {
  LinkEdgeRecord,
  LinkEdgeRepository,
} from "../db/repositories.js";
import type { AgentServiceLink } from "./agent-service.js";

export class AgentServiceLinkPersistenceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AgentServiceLinkPersistenceError";
  }
}

export interface PersistedAgentServiceLinkResult {
  readonly action: "created" | "updated" | "noop";
  readonly link: AgentServiceLink;
  readonly record: LinkEdgeRecord;
}

export const toAgentServiceLinkEdge = (
  link: AgentServiceLink,
): Pick<
  LinkEdgeRecord,
  | "kind"
  | "sourceNodeKind"
  | "sourceNodeId"
  | "targetNodeKind"
  | "targetNodeId"
  | "confidenceTier"
  | "confidenceScore"
  | "evidenceCount"
> => {
  if (link.agentId.length === 0) {
    throw new AgentServiceLinkPersistenceError("Agent link agentId is required");
  }

  if (link.serviceId.length === 0) {
    throw new AgentServiceLinkPersistenceError("Agent link serviceId is required");
  }

  return {
    confidenceScore: link.confidenceScore,
    confidenceTier: link.confidence,
    evidenceCount: link.evidence.length,
    kind: "agent_to_service",
    sourceNodeId: link.agentId,
    sourceNodeKind: "agent",
    targetNodeId: link.serviceId,
    targetNodeKind: "service",
  };
};

export const persistAgentServiceLink = async (
  link: AgentServiceLink,
  repository: LinkEdgeRepository,
): Promise<PersistedAgentServiceLinkResult> => {
  const edge = toAgentServiceLinkEdge(link);
  const existing = await repository.findByPath(edge);

  if (
    existing &&
    existing.confidenceTier === edge.confidenceTier &&
    existing.confidenceScore === edge.confidenceScore &&
    existing.evidenceCount === edge.evidenceCount
  ) {
    return {
      action: "noop",
      link,
      record: existing,
    };
  }

  const record = await repository.upsert(edge);

  return {
    action: existing ? "updated" : "created",
    link,
    record,
  };
};
