import { describe, expect, it, vi } from "vitest";

import type {
  LinkEdgeRepository,
  ServiceRepository,
  WalletRepository,
} from "../../../src/db/repositories.js";
import {
  BazaarPersistenceError,
  persistBazaarResource,
  persistBazaarResources,
  toPersistableBazaarResource,
} from "../../../src/ingest/x402/persist.js";
import { hashStableJson } from "../../../src/core/stable-json.js";

const normalizedResource = {
  amount: "1.00",
  asset: "USDC",
  network: "eip155:8453",
  payTo: "0xabc",
  resourceUrl: "https://service.example.com/search",
  schemaMetadata: {
    inputSchemaUrl: "https://schemas.example.com/in.json",
    outputSchemaUrl: "https://schemas.example.com/out.json",
    schemaId: "search-v1",
  },
  scheme: "exact",
} as const;

const rawSourcePayload = {
  amount: "1.00",
  asset: "USDC",
  network: "eip155:8453",
  payTo: "0xabc",
  resource: "https://service.example.com/search",
  schema: {
    id: "search-v1",
    input: "https://schemas.example.com/in.json",
    output: "https://schemas.example.com/out.json",
  },
  scheme: "exact",
};

const createRepositories = ({
  existingEdge,
  existingService,
}: {
  readonly existingEdge: Awaited<ReturnType<LinkEdgeRepository["findByPath"]>>;
  readonly existingService: Awaited<
    ReturnType<ServiceRepository["findByLocator"]>
  >;
}) => {
  const walletUpsert = vi.fn().mockResolvedValue({
    id: "wallet-1",
    address: "0xabc",
    network: "eip155:8453",
  });
  const serviceUpsert = vi
    .fn<(input: Parameters<ServiceRepository["upsert"]>[0]) => Promise<Awaited<ReturnType<ServiceRepository["upsert"]>>>>()
    .mockImplementation((input) =>
      Promise.resolve({
        id: "service-1",
        resourceUrl: input.resourceUrl,
        payToWalletId: input.payToWalletId,
        network: input.network,
        scheme: input.scheme,
        asset: input.asset,
        amount: input.amount,
        mimeType: input.mimeType,
        description: input.description,
        inputSchemaUrl: input.inputSchemaUrl,
        outputSchemaUrl: input.outputSchemaUrl,
        schemaId: input.schemaId,
        rawSourceJson: input.rawSourceJson,
        sourceFingerprint: input.sourceFingerprint,
      }),
    );
  const linkEdgeUpsert = vi
    .fn<(input: Parameters<LinkEdgeRepository["upsert"]>[0]) => Promise<Awaited<ReturnType<LinkEdgeRepository["upsert"]>>>>()
    .mockImplementation((input) =>
      Promise.resolve({
        id: "edge-1",
        kind: input.kind,
        sourceNodeKind: input.sourceNodeKind,
        sourceNodeId: input.sourceNodeId,
        targetNodeKind: input.targetNodeKind,
        targetNodeId: input.targetNodeId,
        confidenceTier: input.confidenceTier,
        confidenceScore: input.confidenceScore,
        evidenceCount: input.evidenceCount,
      }),
    );
  const wallets: WalletRepository = {
    findByAddressAndNetwork: vi.fn(),
    upsert: walletUpsert,
  };
  const services: ServiceRepository = {
    findByLocator: vi.fn().mockResolvedValue(existingService),
    findByResourceUrl: vi.fn(),
    upsert: serviceUpsert,
  };
  const linkEdges: LinkEdgeRepository = {
    findByPath: vi.fn().mockResolvedValue(existingEdge),
    upsert: linkEdgeUpsert,
  };

  return {
    linkEdges,
    services,
    wallets,
    mocks: {
      linkEdgeUpsert,
      serviceUpsert,
      walletUpsert,
    },
  };
};

describe("toPersistableBazaarResource", () => {
  it("preserves normalized and raw resource payloads for persistence", () => {
    expect(toPersistableBazaarResource(rawSourcePayload, normalizedResource)).toEqual(
      {
        normalized: normalizedResource,
        rawSourcePayload,
      },
    );
  });
});

describe("persistBazaarResource", () => {
  it("inserts a new wallet, service, and service-to-wallet edge", async () => {
    const repositories = createRepositories({
      existingEdge: null,
      existingService: null,
    });

    await expect(
      persistBazaarResource(
        toPersistableBazaarResource(rawSourcePayload, normalizedResource),
        repositories,
      ),
    ).resolves.toEqual({
      action: "created",
      linkEdge: {
        id: "edge-1",
        kind: "service_to_wallet",
        sourceNodeKind: "service",
        sourceNodeId: "service-1",
        targetNodeKind: "wallet",
        targetNodeId: "wallet-1",
        confidenceTier: "medium",
        confidenceScore: 500,
        evidenceCount: 1,
      },
      service: {
        id: "service-1",
        resourceUrl: "https://service.example.com/search",
        payToWalletId: "wallet-1",
        network: "eip155:8453",
        scheme: "exact",
        asset: "USDC",
        amount: "1.00",
        mimeType: null,
        description: null,
        inputSchemaUrl: "https://schemas.example.com/in.json",
        outputSchemaUrl: "https://schemas.example.com/out.json",
        schemaId: "search-v1",
        rawSourceJson: rawSourcePayload,
        sourceFingerprint: hashStableJson(rawSourcePayload),
      },
      sourceFingerprint: hashStableJson(rawSourcePayload),
      wallet: {
        id: "wallet-1",
        address: "0xabc",
        network: "eip155:8453",
      },
    });
  });

  it("updates an existing service when the Bazaar fingerprint changes", async () => {
    const repositories = createRepositories({
      existingEdge: null,
      existingService: {
        id: "service-1",
        resourceUrl: "https://service.example.com/search",
        payToWalletId: "wallet-1",
        network: "eip155:8453",
        scheme: "exact",
        asset: "USDC",
        amount: "1.00",
        mimeType: null,
        description: null,
        inputSchemaUrl: "https://schemas.example.com/in.json",
        outputSchemaUrl: "https://schemas.example.com/out.json",
        schemaId: "search-v1",
        rawSourceJson: { stale: true },
        sourceFingerprint: "old-fingerprint",
      },
    });

    await expect(
      persistBazaarResource(
        toPersistableBazaarResource(rawSourcePayload, normalizedResource),
        repositories,
      ),
    ).resolves.toMatchObject({
      action: "updated",
      sourceFingerprint: hashStableJson(rawSourcePayload),
    });
    expect(repositories.mocks.serviceUpsert).toHaveBeenCalledOnce();
    expect(repositories.mocks.linkEdgeUpsert).toHaveBeenCalledOnce();
  });

  it("updates when the service fingerprint matches but the link edge is missing", async () => {
    const unchangedService = {
      id: "service-1",
      resourceUrl: "https://service.example.com/search",
      payToWalletId: "wallet-1",
      network: "eip155:8453",
      scheme: "exact",
      asset: "USDC",
      amount: "1.00",
      mimeType: null,
      description: null,
      inputSchemaUrl: "https://schemas.example.com/in.json",
      outputSchemaUrl: "https://schemas.example.com/out.json",
      schemaId: "search-v1",
      rawSourceJson: rawSourcePayload,
      sourceFingerprint: hashStableJson(rawSourcePayload),
    };
    const repositories = createRepositories({
      existingEdge: null,
      existingService: unchangedService,
    });

    await expect(
      persistBazaarResource(
        toPersistableBazaarResource(rawSourcePayload, normalizedResource),
        repositories,
      ),
    ).resolves.toMatchObject({
      action: "updated",
      sourceFingerprint: hashStableJson(rawSourcePayload),
    });
    expect(repositories.mocks.serviceUpsert).toHaveBeenCalledOnce();
    expect(repositories.mocks.linkEdgeUpsert).toHaveBeenCalledOnce();
  });

  it("returns a no-op when the source fingerprint and edge already exist", async () => {
    const unchangedService = {
      id: "service-1",
      resourceUrl: "https://service.example.com/search",
      payToWalletId: "wallet-1",
      network: "eip155:8453",
      scheme: "exact",
      asset: "USDC",
      amount: "1.00",
      mimeType: null,
      description: null,
      inputSchemaUrl: "https://schemas.example.com/in.json",
      outputSchemaUrl: "https://schemas.example.com/out.json",
      schemaId: "search-v1",
      rawSourceJson: rawSourcePayload,
      sourceFingerprint: hashStableJson(rawSourcePayload),
    };
    const repositories = createRepositories({
      existingEdge: {
        id: "edge-1",
        kind: "service_to_wallet",
        sourceNodeKind: "service",
        sourceNodeId: "service-1",
        targetNodeKind: "wallet",
        targetNodeId: "wallet-1",
        confidenceTier: "medium",
        confidenceScore: 500,
        evidenceCount: 1,
      },
      existingService: unchangedService,
    });

    await expect(
      persistBazaarResource(
        toPersistableBazaarResource(rawSourcePayload, normalizedResource),
        repositories,
      ),
    ).resolves.toEqual({
      action: "noop",
      linkEdge: {
        id: "edge-1",
        kind: "service_to_wallet",
        sourceNodeKind: "service",
        sourceNodeId: "service-1",
        targetNodeKind: "wallet",
        targetNodeId: "wallet-1",
        confidenceTier: "medium",
        confidenceScore: 500,
        evidenceCount: 1,
      },
      service: unchangedService,
      sourceFingerprint: hashStableJson(rawSourcePayload),
      wallet: {
        id: "wallet-1",
        address: "0xabc",
        network: "eip155:8453",
      },
    });
    expect(repositories.mocks.serviceUpsert).not.toHaveBeenCalled();
    expect(repositories.mocks.linkEdgeUpsert).not.toHaveBeenCalled();
  });

  it("rejects invalid Bazaar resources before any writes", async () => {
    const repositories = createRepositories({
      existingEdge: null,
      existingService: null,
    });

    await expect(
      persistBazaarResource(
        toPersistableBazaarResource(rawSourcePayload, {
          ...normalizedResource,
          payTo: "",
        }),
        repositories,
      ),
    ).rejects.toThrowError(BazaarPersistenceError);
    expect(repositories.mocks.walletUpsert).not.toHaveBeenCalled();
  });

  it("rejects a missing resource URL", async () => {
    const repositories = createRepositories({
      existingEdge: null,
      existingService: null,
    });

    await expect(
      persistBazaarResource(
        toPersistableBazaarResource(rawSourcePayload, {
          ...normalizedResource,
          resourceUrl: "",
        }),
        repositories,
      ),
    ).rejects.toThrowError("Bazaar resource URL is required");
  });

  it("rejects a missing network identifier", async () => {
    const repositories = createRepositories({
      existingEdge: null,
      existingService: null,
    });

    await expect(
      persistBazaarResource(
        toPersistableBazaarResource(rawSourcePayload, {
          ...normalizedResource,
          network: "",
        }),
        repositories,
      ),
    ).rejects.toThrowError("Bazaar network identifier is required");
  });

  it("rejects a missing payment scheme", async () => {
    const repositories = createRepositories({
      existingEdge: null,
      existingService: null,
    });

    await expect(
      persistBazaarResource(
        toPersistableBazaarResource(rawSourcePayload, {
          ...normalizedResource,
          scheme: "",
        }),
        repositories,
      ),
    ).rejects.toThrowError("Bazaar payment scheme is required");
  });
});

describe("persistBazaarResources", () => {
  it("persists multiple resources in order", async () => {
    const repositories = createRepositories({
      existingEdge: null,
      existingService: null,
    });

    await expect(
      persistBazaarResources(
        [
          toPersistableBazaarResource(rawSourcePayload, normalizedResource),
          toPersistableBazaarResource(
            { ...rawSourcePayload, resource: "https://service.example.com/other" },
            { ...normalizedResource, resourceUrl: "https://service.example.com/other" },
          ),
        ],
        repositories,
      ),
    ).resolves.toHaveLength(2);
  });

  it("persists resources without optional schema metadata", async () => {
    const repositories = createRepositories({
      existingEdge: null,
      existingService: null,
    });

    const results = await persistBazaarResources(
      [
        toPersistableBazaarResource(
          {
            amount: "2.00",
            asset: "USDC",
            network: "eip155:8453",
            payTo: "0xdef",
            resource: "https://service.example.com/plain",
            scheme: "exact",
          },
          {
            amount: "2.00",
            asset: "USDC",
            network: "eip155:8453",
            payTo: "0xdef",
            resourceUrl: "https://service.example.com/plain",
            schemaMetadata: null,
            scheme: "exact",
          },
        ),
      ],
      repositories,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      action: "created",
      service: {
        inputSchemaUrl: null,
        outputSchemaUrl: null,
        schemaId: null,
      },
    });
  });
});
