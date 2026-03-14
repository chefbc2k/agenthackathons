import {
  type NormalizedX402BazaarResource,
  parseX402BazaarResource,
} from "../../core/x402.js";

export interface BazaarIngestionRecord {
  readonly normalized: NormalizedX402BazaarResource;
  readonly rawSourcePayload: unknown;
}

export interface BazaarFetchResponse {
  readonly status: number;
  json(): Promise<unknown>;
}

export interface BazaarFetcher {
  fetch(url: string): Promise<BazaarFetchResponse>;
}

export interface BazaarPaginationStrategy {
  getInitialUrl(facilitatorBaseUrl: string): string;
  getNextUrl(
    facilitatorBaseUrl: string,
    currentUrl: string,
    payload: unknown,
  ): string | null;
}

export interface BazaarIngestionOptions {
  readonly fetcher?: BazaarFetcher;
  readonly pagination?: BazaarPaginationStrategy;
}

const DISCOVERY_RESOURCES_PATH = "/discovery/resources";

const defaultFetcher: BazaarFetcher = {
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

const normalizeFacilitatorBaseUrl = (facilitatorBaseUrl: string): string => {
  return facilitatorBaseUrl.trim().replace(/\/+$/u, "");
};

export const buildBazaarDiscoveryUrl = (facilitatorBaseUrl: string): string => {
  return `${normalizeFacilitatorBaseUrl(facilitatorBaseUrl)}${DISCOVERY_RESOURCES_PATH}`;
};

const readArrayProperty = (
  payload: Record<string, unknown>,
  key: "items" | "resources",
): readonly unknown[] => {
  const candidate = payload[key];
  return Array.isArray(candidate) ? candidate : [];
};

export const extractBazaarResourceCandidates = (
  payload: unknown,
): readonly unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const objectPayload = payload as Record<string, unknown>;
  const resources = readArrayProperty(objectPayload, "resources");

  if (resources.length > 0) {
    return resources;
  }

  return readArrayProperty(objectPayload, "items");
};

const readNextCursor = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const nextCursor = (payload as Record<string, unknown>).nextCursor;
  return typeof nextCursor === "string" && nextCursor.length > 0
    ? nextCursor
    : null;
};

export const defaultBazaarPagination: BazaarPaginationStrategy = {
  getInitialUrl: buildBazaarDiscoveryUrl,
  getNextUrl: (_facilitatorBaseUrl, currentUrl, payload) => {
    const nextCursor = readNextCursor(payload);

    if (!nextCursor) {
      return null;
    }

    const nextUrl = new URL(currentUrl);
    nextUrl.searchParams.set("cursor", nextCursor);

    return nextUrl.toString();
  },
};

const normalizeValidResourceRecords = (
  records: readonly unknown[],
): readonly BazaarIngestionRecord[] => {
  return records.flatMap((record) => {
    const parsed = parseX402BazaarResource(record);
    return parsed.success
      ? [
          {
            normalized: parsed.data,
            rawSourcePayload: record,
          } satisfies BazaarIngestionRecord,
        ]
      : [];
  });
};

export const deduplicateBazaarResourceRecords = (
  resources: readonly BazaarIngestionRecord[],
): readonly BazaarIngestionRecord[] => {
  return Array.from(
    resources.reduce(
      (resourceMap, resource) =>
        resourceMap.set(resource.normalized.resourceUrl, resource),
      new Map<string, BazaarIngestionRecord>(),
    ).values(),
  );
};

export const deduplicateBazaarResources = (
  resources: readonly NormalizedX402BazaarResource[],
): readonly NormalizedX402BazaarResource[] => {
  return deduplicateBazaarResourceRecords(
    resources.map((resource) => ({
      normalized: resource,
      rawSourcePayload: resource,
    })),
  ).map((record) => record.normalized);
};

interface BazaarPageFetchResult {
  readonly ok: boolean;
  readonly payload: unknown;
}

const fetchBazaarPage = async (
  url: string,
  fetcher: BazaarFetcher,
): Promise<BazaarPageFetchResult> => {
  let response: BazaarFetchResponse;

  try {
    response = await fetcher.fetch(url);
  } catch {
    return {
      ok: false,
      payload: null,
    };
  }

  if (response.status !== 200) {
    return {
      ok: false,
      payload: null,
    };
  }

  try {
    return {
      ok: true,
      payload: await response.json(),
    };
  } catch {
    return {
      ok: false,
      payload: null,
    };
  }
};

export const ingestBazaarResourceRecords = async (
  facilitatorBaseUrl: string,
  options: BazaarIngestionOptions = {},
): Promise<readonly BazaarIngestionRecord[]> => {
  const fetcher = options.fetcher ?? defaultFetcher;
  const pagination = options.pagination ?? defaultBazaarPagination;
  const visitedUrls = new Set<string>();
  const resources: BazaarIngestionRecord[] = [];
  let currentUrl: string | null = pagination.getInitialUrl(facilitatorBaseUrl);

  while (currentUrl && !visitedUrls.has(currentUrl)) {
    visitedUrls.add(currentUrl);

    const page = await fetchBazaarPage(currentUrl, fetcher);

    if (!page.ok) {
      return [];
    }

    resources.push(
      ...normalizeValidResourceRecords(
        extractBazaarResourceCandidates(page.payload),
      ),
    );
    currentUrl = pagination.getNextUrl(
      facilitatorBaseUrl,
      currentUrl,
      page.payload,
    );
  }

  return deduplicateBazaarResourceRecords(resources);
};

export const ingestBazaarResources = async (
  facilitatorBaseUrl: string,
  options: BazaarIngestionOptions = {},
): Promise<readonly NormalizedX402BazaarResource[]> => {
  const records = await ingestBazaarResourceRecords(
    facilitatorBaseUrl,
    options,
  );

  return records.map((record) => record.normalized);
};
