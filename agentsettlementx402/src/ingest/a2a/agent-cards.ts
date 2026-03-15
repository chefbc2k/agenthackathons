import {
  type NormalizedA2aAgentCard,
  parseA2aAgentCard,
} from "../../core/a2a.js";

// Canonical A2A x402 Extension URI from spec v0.1
const X402_EXTENSION_URI = "https://github.com/google-a2a/a2a-x402/v0.1";

/**
 * Check if an agent card declares support for the A2A x402 extension
 * Extension is declared in capabilities.extensions[] array per A2A x402 spec v0.1
 */
export const supportsX402Extension = (
  agentCard: NormalizedA2aAgentCard,
): boolean => {
  return (
    agentCard.capabilities?.extensions?.some(
      (ext) => ext.uri === X402_EXTENSION_URI,
    ) ?? false
  );
};

export type AgentCardIngestionValidationStatus =
  | "validated"
  | "http_error"
  | "invalid_json"
  | "schema_error"
  | "network_error";

export interface IngestedAgentIdentity {
  readonly agentCardUrl: string;
  readonly displayName: string;
  readonly providerOrganization: string | null;
  readonly providerUrl: string | null;
}

export interface IngestedAgentCardRecord {
  readonly description: string | null;
  readonly documentationUrl: string | null;
  readonly normalizedJson: NormalizedA2aAgentCard;
  readonly rawJson: unknown;
  readonly signatureVerificationStatus: "unverified";
}

export interface AgentCardIngestionResult {
  readonly agent: IngestedAgentIdentity | null;
  readonly agentCard: IngestedAgentCardRecord | null;
  readonly domain: string;
  readonly fetchedAt: Date;
  readonly httpStatus: number | null;
  readonly issues: readonly string[];
  readonly rawJson: unknown;
  readonly sourceUrl: string;
  readonly validationStatus: AgentCardIngestionValidationStatus;
}

export interface AgentCardFetchResponse {
  readonly status: number;
  json(): Promise<unknown>;
}

export interface AgentCardFetcher {
  fetch(url: string): Promise<AgentCardFetchResponse>;
}

export interface AgentCardIngestionPolicy {
  readonly maxAttempts: number;
}

export interface AgentCardIngestionOptions {
  readonly fetcher?: AgentCardFetcher;
  readonly now?: () => Date;
  readonly policy?: AgentCardIngestionPolicy;
}

const WELL_KNOWN_AGENT_CARD_PATH = "/.well-known/agent-card.json";

const defaultFetcher: AgentCardFetcher = {
  fetch: async (url) => {
    const response = await fetch(url);

    return {
      json: async () => {
        const body: unknown = await response.json();
        return body;
      },
      status: response.status,
    };
  },
};

const normalizeDomain = (domain: string): string => {
  const trimmedDomain = domain.trim();

  if (trimmedDomain.startsWith("http://") || trimmedDomain.startsWith("https://")) {
    return new URL(trimmedDomain).host;
  }

  return trimmedDomain.replace(/\/+$/u, "");
};

export const buildAgentCardUrl = (domain: string): string => {
  return `https://${normalizeDomain(domain)}${WELL_KNOWN_AGENT_CARD_PATH}`;
};

export const toIngestedAgentIdentity = (
  agentCard: NormalizedA2aAgentCard,
): IngestedAgentIdentity => {
  return {
    agentCardUrl: agentCard.agentCardUrl,
    displayName: agentCard.name,
    providerOrganization: agentCard.provider?.organization ?? null,
    providerUrl: agentCard.provider?.url ?? null,
  };
};

export const toIngestedAgentCardRecord = (
  rawJson: unknown,
  agentCard: NormalizedA2aAgentCard,
): IngestedAgentCardRecord => {
  return {
    description: agentCard.description,
    documentationUrl: agentCard.documentationUrl,
    normalizedJson: agentCard,
    rawJson,
    signatureVerificationStatus: "unverified",
  };
};

const createBaseResult = (
  domain: string,
  sourceUrl: string,
  fetchedAt: Date,
): Omit<
  AgentCardIngestionResult,
  "agent" | "agentCard" | "httpStatus" | "issues" | "rawJson" | "validationStatus"
> => ({
  domain,
  fetchedAt,
  sourceUrl,
});

const getMaxAttempts = (policy: AgentCardIngestionPolicy | undefined): number => {
  const configuredAttempts = policy?.maxAttempts ?? 1;
  return configuredAttempts < 1 ? 1 : configuredAttempts;
};

const ingestAgentCard = async (
  domain: string,
  options: Required<Pick<AgentCardIngestionOptions, "fetcher" | "now">> & {
    readonly policy: AgentCardIngestionPolicy | undefined;
  },
): Promise<AgentCardIngestionResult> => {
  const sourceUrl = buildAgentCardUrl(domain);
  const fetchedAt = options.now();
  const baseResult = createBaseResult(domain, sourceUrl, fetchedAt);
  const maxAttempts = getMaxAttempts(options.policy);
  let finalNetworkIssue = "Network request failed";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await options.fetcher.fetch(sourceUrl);

      if (response.status !== 200) {
        return {
          ...baseResult,
          agent: null,
          agentCard: null,
          httpStatus: response.status,
          issues: [`HTTP ${response.status}`],
          rawJson: null,
          validationStatus: "http_error",
        };
      }

      let rawJson: unknown;

      try {
        rawJson = await response.json();
      } catch (error) {
        return {
          ...baseResult,
          agent: null,
          agentCard: null,
          httpStatus: response.status,
          issues: [error instanceof Error ? error.message : "Invalid JSON response"],
          rawJson: null,
          validationStatus: "invalid_json",
        };
      }

      const parsed = parseA2aAgentCard(rawJson);

      if (!parsed.success) {
        return {
          ...baseResult,
          agent: null,
          agentCard: null,
          httpStatus: response.status,
          issues: parsed.issues,
          rawJson,
          validationStatus: "schema_error",
        };
      }

      return {
        ...baseResult,
        agent: toIngestedAgentIdentity(parsed.data),
        agentCard: toIngestedAgentCardRecord(rawJson, parsed.data),
        httpStatus: response.status,
        issues: [],
        rawJson,
        validationStatus: "validated",
      };
    } catch (error) {
      finalNetworkIssue =
        error instanceof Error ? error.message : "Network request failed";

      if (attempt < maxAttempts) {
        continue;
      }
    }
  }

  return {
    ...baseResult,
    agent: null,
    agentCard: null,
    httpStatus: null,
    issues: [finalNetworkIssue],
    rawJson: null,
    validationStatus: "network_error",
  };
};

export const ingestAgentCards = async (
  domains: readonly string[],
  options: AgentCardIngestionOptions = {},
): Promise<readonly AgentCardIngestionResult[]> => {
  const fetcher = options.fetcher ?? defaultFetcher;
  const now = options.now ?? (() => new Date());

  return Promise.all(
    domains.map((domain) =>
      ingestAgentCard(domain, {
        fetcher,
        now,
        policy: options.policy,
      }),
    ),
  );
};
