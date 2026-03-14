import type {
  LinkEdgeRecord,
  LinkEdgeRepository,
  ServiceRecord,
  ServiceRepository,
  WalletRecord,
  WalletRepository,
} from "../../db/repositories.js";
import type { NormalizedX402BazaarResource } from "../../core/x402.js";
import { hashStableJson } from "../../core/stable-json.js";

export class BazaarPersistenceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BazaarPersistenceError";
  }
}

export interface PersistableBazaarResource {
  readonly normalized: NormalizedX402BazaarResource;
  readonly rawSourcePayload: unknown;
}

export interface BazaarPersistenceRepositories {
  readonly linkEdges: LinkEdgeRepository;
  readonly services: ServiceRepository;
  readonly wallets: WalletRepository;
}

export interface PersistedBazaarResourceResult {
  readonly action: "created" | "updated" | "noop";
  readonly linkEdge: LinkEdgeRecord;
  readonly service: ServiceRecord;
  readonly sourceFingerprint: string;
  readonly wallet: WalletRecord;
}

export const toPersistableBazaarResource = (
  rawSourcePayload: unknown,
  normalized: NormalizedX402BazaarResource,
): PersistableBazaarResource => {
  return {
    normalized,
    rawSourcePayload,
  };
};

const ensurePersistableResource = (
  resource: PersistableBazaarResource,
): PersistableBazaarResource => {
  if (resource.normalized.resourceUrl.length === 0) {
    throw new BazaarPersistenceError("Bazaar resource URL is required");
  }

  if (resource.normalized.payTo.length === 0) {
    throw new BazaarPersistenceError("Bazaar payTo wallet address is required");
  }

  if (resource.normalized.network.length === 0) {
    throw new BazaarPersistenceError("Bazaar network identifier is required");
  }

  if (resource.normalized.scheme.length === 0) {
    throw new BazaarPersistenceError("Bazaar payment scheme is required");
  }

  return resource;
};

const buildServiceToWalletEdge = (
  serviceId: string,
  walletId: string,
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
  return {
    confidenceScore: 500,
    confidenceTier: "medium",
    evidenceCount: 1,
    kind: "service_to_wallet",
    sourceNodeId: serviceId,
    sourceNodeKind: "service",
    targetNodeId: walletId,
    targetNodeKind: "wallet",
  };
};

export const persistBazaarResource = async (
  resource: PersistableBazaarResource,
  repositories: BazaarPersistenceRepositories,
): Promise<PersistedBazaarResourceResult> => {
  const persistable = ensurePersistableResource(resource);
  const sourceFingerprint = hashStableJson(persistable.rawSourcePayload);
  const wallet = await repositories.wallets.upsert({
    address: persistable.normalized.payTo,
    network: persistable.normalized.network,
  });
  const existingService = await repositories.services.findByLocator({
    network: persistable.normalized.network,
    resourceUrl: persistable.normalized.resourceUrl,
    scheme: persistable.normalized.scheme,
  });
  const serviceInput = {
    amount: persistable.normalized.amount,
    asset: persistable.normalized.asset,
    description: null,
    inputSchemaUrl: persistable.normalized.schemaMetadata?.inputSchemaUrl ?? null,
    mimeType: null,
    network: persistable.normalized.network,
    outputSchemaUrl:
      persistable.normalized.schemaMetadata?.outputSchemaUrl ?? null,
    payToWalletId: wallet.id,
    rawSourceJson: persistable.rawSourcePayload,
    resourceUrl: persistable.normalized.resourceUrl,
    schemaId: persistable.normalized.schemaMetadata?.schemaId ?? null,
    scheme: persistable.normalized.scheme,
    sourceFingerprint,
  } as const;

  if (
    existingService &&
    existingService.payToWalletId === wallet.id &&
    existingService.sourceFingerprint === sourceFingerprint
  ) {
    const existingEdge = await repositories.linkEdges.findByPath(
      buildServiceToWalletEdge(existingService.id, wallet.id),
    );

    if (existingEdge) {
      return {
        action: "noop",
        linkEdge: existingEdge,
        service: existingService,
        sourceFingerprint,
        wallet,
      };
    }
  }

  const service = await repositories.services.upsert(serviceInput);
  const linkEdge = await repositories.linkEdges.upsert(
    buildServiceToWalletEdge(service.id, wallet.id),
  );

  return {
    action: existingService ? "updated" : "created",
    linkEdge,
    service,
    sourceFingerprint,
    wallet,
  };
};

export const persistBazaarResources = async (
  resources: readonly PersistableBazaarResource[],
  repositories: BazaarPersistenceRepositories,
): Promise<readonly PersistedBazaarResourceResult[]> => {
  return Promise.all(
    resources.map((resource) => persistBazaarResource(resource, repositories)),
  );
};
