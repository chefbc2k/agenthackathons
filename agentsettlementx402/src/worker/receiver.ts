import { Receiver } from "@upstash/qstash";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import { hashStableJson } from "../core/stable-json.js";
import type { WorkerRunResult, WorkerJobPayload } from "./orchestrator.js";
import { workerJobPayloadSchema } from "./orchestrator.js";
import type { WorkerIdempotencyStore } from "./idempotency.js";

export interface WorkerReceiverRequest {
  readonly body: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly method: string;
  readonly url: string;
}

export interface WorkerReceiverResponse {
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
  readonly status: number;
}

export interface QstashRequestVerifier {
  verify(request: {
    readonly body: string;
    readonly signature: string;
    readonly upstashRegion?: string;
    readonly url?: string;
  }): Promise<boolean>;
}

export interface WorkerReceiverDependencies {
  readonly idempotencyStore: WorkerIdempotencyStore;
  readonly idempotencyTtlSeconds?: number;
  readonly runJob: (payload: WorkerJobPayload) => Promise<WorkerRunResult>;
  readonly verifier?: QstashRequestVerifier;
}

export interface WorkerReceiverServer {
  close(callback?: (error?: Error) => void): void;
  listen(port: number, hostname: string, callback?: () => void): void;
}

export interface StartedWorkerReceiverServer {
  readonly close: () => Promise<void>;
  readonly port: number;
}

export type WorkerReceiverServerFactory = (
  listener: (request: IncomingMessage, response: ServerResponse) => void,
) => WorkerReceiverServer;

export const createDefaultWorkerReceiverServer = (
  listener: (request: IncomingMessage, response: ServerResponse) => void,
): WorkerReceiverServer => {
  return createServer(listener) as unknown as WorkerReceiverServer;
};

export const resolveWorkerReceiverServerFactory = (
  serverFactory?: WorkerReceiverServerFactory,
): WorkerReceiverServerFactory => {
  return serverFactory ?? createDefaultWorkerReceiverServer;
};

const defaultHeaders = {
  "content-type": "application/json; charset=utf-8",
} as const;

const createJsonResponse = (
  status: number,
  body: unknown,
): WorkerReceiverResponse => ({
  body,
  headers: defaultHeaders,
  status,
});

const getHeader = (
  headers: Readonly<Record<string, string | undefined>>,
  name: string,
): string | null => {
  const found = Object.entries(headers).find(
    ([headerName]) => headerName.toLowerCase() === name.toLowerCase(),
  );

  return found?.[1] ?? null;
};

export const resolveWorkerIdempotencyKey = (
  request: WorkerReceiverRequest,
  payload: WorkerJobPayload,
): string => {
  return (
    getHeader(request.headers, "upstash-message-id") ??
    payload.jobKey ??
    hashStableJson({
      body: request.body,
      url: request.url,
    })
  );
};

export const createQstashRequestVerifier = (config: {
  readonly currentSigningKey: string;
  readonly nextSigningKey: string;
}): QstashRequestVerifier => {
  return new Receiver({
    currentSigningKey: config.currentSigningKey,
    nextSigningKey: config.nextSigningKey,
  }) as unknown as QstashRequestVerifier;
};

export const handleWorkerReceiverRequest = async (
  request: WorkerReceiverRequest,
  dependencies: WorkerReceiverDependencies,
): Promise<WorkerReceiverResponse> => {
  if (request.method !== "POST") {
    return createJsonResponse(405, {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Only POST is supported",
      },
    });
  }

  let payloadValue: unknown;

  try {
    payloadValue = JSON.parse(request.body);
  } catch {
    return createJsonResponse(400, {
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON",
      },
    });
  }

  const parsed = workerJobPayloadSchema.safeParse(payloadValue);

  if (!parsed.success) {
    return createJsonResponse(400, {
      error: {
        code: "INVALID_PAYLOAD",
        message: "Worker payload validation failed",
      },
    });
  }

  if (dependencies.verifier) {
    const signature = getHeader(request.headers, "upstash-signature");

    if (!signature) {
      return createJsonResponse(401, {
        error: {
          code: "MISSING_SIGNATURE",
          message: "QStash signature header is required",
        },
      });
    }

    try {
      await dependencies.verifier.verify({
        body: request.body,
        signature,
        ...(getHeader(request.headers, "upstash-region")
          ? {
              upstashRegion: getHeader(request.headers, "upstash-region") as string,
            }
          : {}),
        ...(request.url.length > 0 ? { url: request.url } : {}),
      });
    } catch {
      return createJsonResponse(401, {
        error: {
          code: "INVALID_SIGNATURE",
          message: "QStash signature verification failed",
        },
      });
    }
  }

  const idempotencyKey = resolveWorkerIdempotencyKey(request, parsed.data);
  const existing = await dependencies.idempotencyStore.get(idempotencyKey);

  if (existing?.status === "completed" && existing.result) {
    return createJsonResponse(200, {
      idempotencyKey,
      replayed: true,
      result: existing.result,
      status: "completed",
    });
  }

  if (existing?.status === "in_progress") {
    return createJsonResponse(202, {
      idempotencyKey,
      replayed: false,
      status: "in_progress",
    });
  }

  const ttlSeconds = dependencies.idempotencyTtlSeconds ?? 300;
  const claimed = await dependencies.idempotencyStore.claim(
    idempotencyKey,
    ttlSeconds,
  );

  if (!claimed) {
    return createJsonResponse(202, {
      idempotencyKey,
      replayed: false,
      status: "in_progress",
    });
  }

  try {
    const result = await dependencies.runJob(parsed.data);
    await dependencies.idempotencyStore.complete(
      idempotencyKey,
      result,
      ttlSeconds,
    );

    return createJsonResponse(200, {
      idempotencyKey,
      replayed: false,
      result,
      status: "completed",
    });
  } catch {
    return createJsonResponse(500, {
      error: {
        code: "JOB_FAILED",
        message: "Worker job execution failed",
      },
      idempotencyKey,
    });
  }
};

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk: string | Uint8Array) => {
      body +=
        typeof chunk === "string"
          ? chunk
          : new TextDecoder().decode(chunk);
    });
    request.on("end", () => {
      resolve(body);
    });
    request.on("error", (error: Error) => {
      reject(error);
    });
  });
};

export const createWorkerReceiverListener = (
  dependencies: WorkerReceiverDependencies,
): ((
  request: IncomingMessage,
  response: ServerResponse,
) => void) => {
  return (request, response) => {
    void readRequestBody(request)
      .then((body) =>
        handleWorkerReceiverRequest(
          {
            body,
            headers: Object.fromEntries(
              Object.entries(request.headers).map(([name, value]) => [
                name,
                Array.isArray(value) ? value[0] : value,
              ]),
            ),
            method: request.method ?? "POST",
            url: request.url ?? "/",
          },
          dependencies,
        ),
      )
      .then((result) => {
        response.statusCode = result.status;

        for (const [name, value] of Object.entries(result.headers)) {
          response.setHeader(name, value);
        }

        response.end(JSON.stringify(result.body));
      })
      .catch(() => undefined);
  };
};

export const startWorkerReceiverServer = async (options: {
  readonly dependencies: WorkerReceiverDependencies;
  readonly hostname?: string;
  readonly port?: number;
  readonly serverFactory?: WorkerReceiverServerFactory;
}): Promise<StartedWorkerReceiverServer> => {
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? 8787;
  const serverFactory = resolveWorkerReceiverServerFactory(options.serverFactory);
  const server = serverFactory(createWorkerReceiverListener(options.dependencies));

  await new Promise<void>((resolve) => {
    server.listen(port, hostname, () => {
      resolve();
    });
  });

  return {
    close: async () => {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
    port,
  };
};
