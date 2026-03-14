import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildBazaarDiscoveryUrl,
  deduplicateBazaarResources,
  deduplicateBazaarResourceRecords,
  defaultBazaarPagination,
  extractBazaarResourceCandidates,
  ingestBazaarResourceRecords,
  ingestBazaarResources,
  type BazaarFetcher,
} from "../../../src/ingest/x402/bazaar.js";
import * as x402IngestExports from "../../../src/ingest/x402/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildBazaarDiscoveryUrl", () => {
  it("normalizes facilitator URLs and appends the discovery path", () => {
    expect(buildBazaarDiscoveryUrl("https://facilitator.example.com")).toBe(
      "https://facilitator.example.com/discovery/resources",
    );
    expect(buildBazaarDiscoveryUrl("https://facilitator.example.com/")).toBe(
      "https://facilitator.example.com/discovery/resources",
    );
  });
});

describe("extractBazaarResourceCandidates", () => {
  it("reads array, resources, and items payload shapes", () => {
    expect(extractBazaarResourceCandidates([{ resource: "a" }])).toEqual([
      { resource: "a" },
    ]);
    expect(
      extractBazaarResourceCandidates({
        resources: [{ resource: "b" }],
      }),
    ).toEqual([{ resource: "b" }]);
    expect(
      extractBazaarResourceCandidates({
        items: [{ resource: "c" }],
      }),
    ).toEqual([{ resource: "c" }]);
  });

  it("returns an empty list for unsupported payload shapes", () => {
    expect(extractBazaarResourceCandidates(null)).toEqual([]);
    expect(extractBazaarResourceCandidates({ resources: "nope" })).toEqual([]);
  });
});

describe("deduplicateBazaarResources", () => {
  it("keeps the last resource for a repeated resource URL", () => {
    expect(
      deduplicateBazaarResources([
        {
          amount: "1",
          asset: "USDC",
          network: "eip155:8453",
          payTo: "0xabc",
          resourceUrl: "https://service.example.com/a",
          schemaMetadata: null,
          scheme: "exact",
        },
        {
          amount: "2",
          asset: "USDC",
          network: "eip155:8453",
          payTo: "0xdef",
          resourceUrl: "https://service.example.com/a",
          schemaMetadata: null,
          scheme: "exact",
        },
      ]),
    ).toEqual([
      {
        amount: "2",
        asset: "USDC",
        network: "eip155:8453",
        payTo: "0xdef",
        resourceUrl: "https://service.example.com/a",
        schemaMetadata: null,
        scheme: "exact",
      },
    ]);
  });
});

describe("deduplicateBazaarResourceRecords", () => {
  it("keeps the last raw-preserving record for a repeated resource URL", () => {
    expect(
      deduplicateBazaarResourceRecords([
        {
          normalized: {
            amount: null,
            asset: null,
            network: "eip155:8453",
            payTo: "0xabc",
            resourceUrl: "https://service.example.com/a",
            schemaMetadata: null,
            scheme: "exact",
          },
          rawSourcePayload: {
            version: 1,
          },
        },
        {
          normalized: {
            amount: "2",
            asset: "USDC",
            network: "eip155:8453",
            payTo: "0xdef",
            resourceUrl: "https://service.example.com/a",
            schemaMetadata: null,
            scheme: "exact",
          },
          rawSourcePayload: {
            version: 2,
          },
        },
      ]),
    ).toEqual([
      {
        normalized: {
          amount: "2",
          asset: "USDC",
          network: "eip155:8453",
          payTo: "0xdef",
          resourceUrl: "https://service.example.com/a",
          schemaMetadata: null,
          scheme: "exact",
        },
        rawSourcePayload: {
          version: 2,
        },
      },
    ]);
  });
});

describe("defaultBazaarPagination", () => {
  it("builds cursor-based follow-up URLs when nextCursor is present", () => {
    expect(
      defaultBazaarPagination.getNextUrl(
        "https://facilitator.example.com",
        "https://facilitator.example.com/discovery/resources",
        { nextCursor: "cursor-2" },
      ),
    ).toBe(
      "https://facilitator.example.com/discovery/resources?cursor=cursor-2",
    );
    expect(
      defaultBazaarPagination.getNextUrl(
        "https://facilitator.example.com",
        "https://facilitator.example.com/discovery/resources",
        { nextCursor: "" },
      ),
    ).toBeNull();
    expect(
      defaultBazaarPagination.getNextUrl(
        "https://facilitator.example.com",
        "https://facilitator.example.com/discovery/resources",
        null,
      ),
    ).toBeNull();
  });
});

describe("ingestBazaarResources", () => {
  it("returns normalized resources for a valid facilitator response", async () => {
    const fetcher: BazaarFetcher = {
      fetch: vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({
          resources: [
            {
              amount: "1.00",
              asset: "USDC",
              network: "eip155:8453",
              payTo: "0xabc",
              resource: "https://service.example.com/search",
              schema: {
                id: "search-v1",
                input: "https://schemas.example.com/search-input.json",
                output: "https://schemas.example.com/search-output.json",
              },
              scheme: "exact",
            },
          ],
        }),
      }),
    };

    await expect(
      ingestBazaarResources("https://facilitator.example.com", { fetcher }),
    ).resolves.toEqual([
      {
        amount: "1.00",
        asset: "USDC",
        network: "eip155:8453",
        payTo: "0xabc",
        resourceUrl: "https://service.example.com/search",
        schemaMetadata: {
          inputSchemaUrl: "https://schemas.example.com/search-input.json",
          outputSchemaUrl: "https://schemas.example.com/search-output.json",
          schemaId: "search-v1",
        },
        scheme: "exact",
      },
    ]);
  });

  it("returns raw-preserving records for a valid facilitator response", async () => {
    const fetcher: BazaarFetcher = {
      fetch: vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue([
          {
            network: "eip155:8453",
            payTo: "0xabc",
            resource: "https://service.example.com/a",
            scheme: "exact",
          },
        ]),
      }),
    };

    await expect(
      ingestBazaarResourceRecords("https://facilitator.example.com", { fetcher }),
    ).resolves.toEqual([
      {
        normalized: {
          amount: null,
          asset: null,
          network: "eip155:8453",
          payTo: "0xabc",
          resourceUrl: "https://service.example.com/a",
          schemaMetadata: null,
          scheme: "exact",
        },
        rawSourcePayload: {
          network: "eip155:8453",
          payTo: "0xabc",
          resource: "https://service.example.com/a",
          scheme: "exact",
        },
      },
    ]);
  });

  it("returns an empty list for an empty facilitator response", async () => {
    const fetcher: BazaarFetcher = {
      fetch: vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({
          resources: [],
        }),
      }),
    };

    await expect(
      ingestBazaarResources("https://facilitator.example.com", { fetcher }),
    ).resolves.toEqual([]);
  });

  it("filters malformed records while keeping valid normalized entries", async () => {
    const fetcher: BazaarFetcher = {
      fetch: vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({
          items: [
            {
              amount: "2.50",
              asset: "USDC",
              network: "eip155:8453",
              payTo: "0xabc",
              resource: "https://service.example.com/valid",
              scheme: "exact",
            },
            {
              network: "eip155:8453",
              payTo: "0xabc",
              scheme: "exact",
            },
          ],
        }),
      }),
    };

    await expect(
      ingestBazaarResources("https://facilitator.example.com", { fetcher }),
    ).resolves.toEqual([
      {
        amount: "2.50",
        asset: "USDC",
        network: "eip155:8453",
        payTo: "0xabc",
        resourceUrl: "https://service.example.com/valid",
        schemaMetadata: null,
        scheme: "exact",
      },
    ]);
  });

  it("returns an empty list when the facilitator is unavailable", async () => {
    const fetcher: BazaarFetcher = {
      fetch: vi.fn().mockResolvedValue({
        status: 503,
        json: vi.fn(),
      }),
    };

    await expect(
      ingestBazaarResources("https://facilitator.example.com", { fetcher }),
    ).resolves.toEqual([]);
  });

  it("returns an empty list when the request times out or fails", async () => {
    const fetcher: BazaarFetcher = {
      fetch: vi.fn().mockRejectedValue(new Error("timeout")),
    };

    await expect(
      ingestBazaarResources("https://facilitator.example.com", { fetcher }),
    ).resolves.toEqual([]);
  });

  it("returns an empty list when json parsing fails", async () => {
    const fetcher: BazaarFetcher = {
      fetch: vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockRejectedValue(new Error("bad-json")),
      }),
    };

    await expect(
      ingestBazaarResources("https://facilitator.example.com", { fetcher }),
    ).resolves.toEqual([]);
  });

  it("follows cursor pagination and stops if a URL repeats", async () => {
    const fetcher: BazaarFetcher = {
      fetch: vi
        .fn()
        .mockResolvedValueOnce({
          status: 200,
          json: vi.fn().mockResolvedValue({
            nextCursor: "cursor-2",
            resources: [
              {
                amount: "1.00",
                asset: "USDC",
                network: "eip155:8453",
                payTo: "0xabc",
                resource: "https://service.example.com/one",
                scheme: "exact",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: vi.fn().mockResolvedValue({
            nextCursor: "cursor-2",
            resources: [
              {
                amount: "2.00",
                asset: "USDC",
                network: "eip155:8453",
                payTo: "0xdef",
                resource: "https://service.example.com/two",
                scheme: "exact",
              },
            ],
          }),
        }),
    };

    await expect(
      ingestBazaarResources("https://facilitator.example.com", { fetcher }),
    ).resolves.toEqual([
      {
        amount: "1.00",
        asset: "USDC",
        network: "eip155:8453",
        payTo: "0xabc",
        resourceUrl: "https://service.example.com/one",
        schemaMetadata: null,
        scheme: "exact",
      },
      {
        amount: "2.00",
        asset: "USDC",
        network: "eip155:8453",
        payTo: "0xdef",
        resourceUrl: "https://service.example.com/two",
        schemaMetadata: null,
        scheme: "exact",
      },
    ]);
  });

  it("uses the built-in fetch implementation when no custom fetcher is provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () =>
        Promise.resolve([
          {
            amount: "3.00",
            asset: "USDC",
            network: "eip155:8453",
            payTo: "0xaaa",
            resource: "https://service.example.com/default",
            scheme: "exact",
          },
        ]),
      status: 200,
    } as Response);

    await expect(
      ingestBazaarResources("https://facilitator.example.com"),
    ).resolves.toEqual([
      {
        amount: "3.00",
        asset: "USDC",
        network: "eip155:8453",
        payTo: "0xaaa",
        resourceUrl: "https://service.example.com/default",
        schemaMetadata: null,
        scheme: "exact",
      },
    ]);
  });
});

describe("x402 ingest barrel exports", () => {
  it("re-exports the bazaar ingest module", () => {
    expect(typeof x402IngestExports.ingestBazaarResources).toBe("function");
    expect(typeof x402IngestExports.ingestBazaarResourceRecords).toBe("function");
    expect(typeof x402IngestExports.toPersistableBazaarResource).toBe("function");
    expect(
      typeof x402IngestExports.x402IngestModuleExports.bazaar
        .ingestBazaarResources,
    ).toBe("function");
    expect(
      typeof x402IngestExports.x402IngestModuleExports.bazaar
        .ingestBazaarResourceRecords,
    ).toBe("function");
    expect(
      typeof x402IngestExports.x402IngestModuleExports.persist
        .persistBazaarResource,
    ).toBe("function");
  });
});
