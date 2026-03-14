import type { SignatureVerificationStatus } from "../db/schema.js";

export const linkConfidenceValues = ["low", "medium", "high"] as const;

export type LinkConfidence = (typeof linkConfidenceValues)[number];

export interface AgentServiceDeclaration {
  readonly network: string | null;
  readonly payToAddress: string | null;
  readonly proofOfOwnership: boolean;
  readonly resourceUrl: string | null;
  readonly scheme: string | null;
  readonly source: string;
}

export interface LinkableAgent {
  readonly agentCardUrl: string;
  readonly declaredServiceBindings: readonly AgentServiceDeclaration[];
  readonly displayName: string;
  readonly id: string;
  readonly providerOrganization: string | null;
  readonly providerUrl: string | null;
  readonly signatureVerificationStatus: SignatureVerificationStatus;
}

export interface LinkableService {
  readonly id: string;
  readonly network: string;
  readonly payToAddress: string;
  readonly resourceUrl: string;
  readonly scheme: string;
}

export interface AgentServiceLinkEvidence {
  readonly declarationSource: string | null;
  readonly matchedAgentHostname: string | null;
  readonly matchedPayToAddress: string | null;
  readonly matchedResourceHostname: string | null;
  readonly proofOfOwnership: boolean;
  readonly rule: "explicit_declaration" | "domain_match" | "heuristic_hostname_label";
  readonly signatureVerified: boolean;
  readonly summary: string;
}

export interface AgentServiceLink {
  readonly agentId: string;
  readonly confidence: LinkConfidence;
  readonly confidenceScore: number;
  readonly evidence: readonly AgentServiceLinkEvidence[];
  readonly serviceId: string;
}

export interface LinkAgentsToServicesOptions {
  readonly enableHeuristicLinking?: boolean;
}

const confidenceOrder: Record<LinkConfidence, number> = {
  high: 3,
  low: 1,
  medium: 2,
};

const confidenceScoreByLevel: Record<LinkConfidence, number> = {
  high: 900,
  low: 300,
  medium: 600,
};

const safeHostname = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const getAgentHostnames = (agent: LinkableAgent): readonly string[] => {
  return Array.from(
    new Set(
      [safeHostname(agent.agentCardUrl), safeHostname(agent.providerUrl)].flatMap(
        (hostname) => (hostname ? [hostname] : []),
      ),
    ),
  );
};

const getServiceHostname = (service: LinkableService): string | null => {
  return safeHostname(service.resourceUrl);
};

const declarationMatchesService = (
  declaration: AgentServiceDeclaration,
  service: LinkableService,
): boolean => {
  if (declaration.resourceUrl && declaration.resourceUrl !== service.resourceUrl) {
    return false;
  }

  if (declaration.network && declaration.network !== service.network) {
    return false;
  }

  if (declaration.scheme && declaration.scheme !== service.scheme) {
    return false;
  }

  if (declaration.payToAddress && declaration.payToAddress !== service.payToAddress) {
    return false;
  }

  return declaration.resourceUrl !== null || declaration.payToAddress !== null;
};

const buildExplicitEvidence = (
  agent: LinkableAgent,
  declaration: AgentServiceDeclaration,
  service: LinkableService,
): AgentServiceLinkEvidence | null => {
  const signatureVerified = agent.signatureVerificationStatus === "verified";

  if (!declarationMatchesService(declaration, service)) {
    return null;
  }

  if (!signatureVerified && !declaration.proofOfOwnership) {
    return null;
  }

  return {
    declarationSource: declaration.source,
    matchedAgentHostname: safeHostname(agent.agentCardUrl),
    matchedPayToAddress: service.payToAddress,
    matchedResourceHostname: getServiceHostname(service),
    proofOfOwnership: declaration.proofOfOwnership,
    rule: "explicit_declaration",
    signatureVerified,
    summary:
      "Agent explicitly declares the service or wallet and includes a verified signature or ownership proof.",
  };
};

const hasConsistentPayToUsage = (
  services: readonly LinkableService[],
  hostname: string,
): boolean => {
  const matchingPayTos = new Set(
    services
      .filter((service) => getServiceHostname(service) === hostname)
      .map((service) => service.payToAddress),
  );

  return matchingPayTos.size === 1;
};

const buildMediumEvidence = (
  agent: LinkableAgent,
  service: LinkableService,
  services: readonly LinkableService[],
): AgentServiceLinkEvidence | null => {
  const serviceHostname = getServiceHostname(service);

  if (!serviceHostname) {
    return null;
  }

  const matchedAgentHostname = getAgentHostnames(agent).find(
    (hostname) => hostname === serviceHostname,
  );

  if (!matchedAgentHostname) {
    return null;
  }

  if (!hasConsistentPayToUsage(services, serviceHostname)) {
    return null;
  }

  return {
    declarationSource: null,
    matchedAgentHostname,
    matchedPayToAddress: service.payToAddress,
    matchedResourceHostname: serviceHostname,
    proofOfOwnership: false,
    rule: "domain_match",
    signatureVerified: agent.signatureVerificationStatus === "verified",
    summary:
      "Service hostname matches the agent domain and all services on that hostname use a consistent payTo address.",
  };
};

const getHostnameLabels = (hostname: string | null): readonly string[] => {
  if (!hostname) {
    return [];
  }

  return hostname.split(".").filter((label) => label.length > 0);
};

const buildLowEvidence = (
  agent: LinkableAgent,
  service: LinkableService,
): AgentServiceLinkEvidence | null => {
  const serviceLabels = new Set(getHostnameLabels(getServiceHostname(service)));
  const matchingAgentHostname = getAgentHostnames(agent).find((hostname) =>
    getHostnameLabels(hostname).some((label) => serviceLabels.has(label)),
  );

  if (!matchingAgentHostname) {
    return null;
  }

  return {
    declarationSource: null,
    matchedAgentHostname: matchingAgentHostname,
    matchedPayToAddress: service.payToAddress,
    matchedResourceHostname: getServiceHostname(service),
    proofOfOwnership: false,
    rule: "heuristic_hostname_label",
    signatureVerified: agent.signatureVerificationStatus === "verified",
    summary:
      "Agent and service hostnames share a hostname label, which is a weak heuristic and disabled by default.",
  };
};

const buildLinkCandidate = (
  agent: LinkableAgent,
  service: LinkableService,
  services: readonly LinkableService[],
  options: LinkAgentsToServicesOptions,
): AgentServiceLink | null => {
  const evidences: AgentServiceLinkEvidence[] = [];

  for (const declaration of agent.declaredServiceBindings) {
    const explicitEvidence = buildExplicitEvidence(agent, declaration, service);

    if (explicitEvidence) {
      evidences.push(explicitEvidence);
    }
  }

  const mediumEvidence = buildMediumEvidence(agent, service, services);

  if (mediumEvidence) {
    evidences.push(mediumEvidence);
  }

  if (options.enableHeuristicLinking) {
    const lowEvidence = buildLowEvidence(agent, service);

    if (lowEvidence) {
      evidences.push(lowEvidence);
    }
  }

  if (evidences.length === 0) {
    return null;
  }

  const confidence = evidences.reduce<LinkConfidence>((best, evidence) => {
    const current =
      evidence.rule === "explicit_declaration"
        ? "high"
        : evidence.rule === "domain_match"
          ? "medium"
          : "low";

    return confidenceOrder[current] > confidenceOrder[best] ? current : best;
  }, "low");

  return {
    agentId: agent.id,
    confidence,
    confidenceScore: confidenceScoreByLevel[confidence],
    evidence: evidences,
    serviceId: service.id,
  };
};

const compareLinks = (left: AgentServiceLink, right: AgentServiceLink): number => {
  if (left.agentId !== right.agentId) {
    return left.agentId.localeCompare(right.agentId);
  }

  return left.serviceId.localeCompare(right.serviceId);
};

export const linkAgentsToServices = (
  agents: readonly LinkableAgent[],
  services: readonly LinkableService[],
  options: LinkAgentsToServicesOptions = {},
): readonly AgentServiceLink[] => {
  return agents
    .flatMap((agent) =>
      services.flatMap((service) => {
        const candidate = buildLinkCandidate(agent, service, services, options);
        return candidate ? [candidate] : [];
      }),
    )
    .sort(compareLinks);
};
