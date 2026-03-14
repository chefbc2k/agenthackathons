import { loadWorkerConfig } from "./config.js";
import {
  createEmptyWorkerDependencies,
  runWorkerJob,
  type WorkerJobPayload,
} from "./orchestrator.js";
import {
  createQstashRequestVerifier,
  startWorkerReceiverServer,
} from "./receiver.js";
import { createUpstashWorkerIdempotencyStore } from "./idempotency.js";

const readEnvironment = (): Record<string, string | undefined> => {
  const runtime = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return runtime.process?.env ?? {};
};

export const buildWorkerJobFromConfig = (): WorkerJobPayload => {
  const config = loadWorkerConfig(readEnvironment());

  return {
    agentDomains: [...config.agentDomains],
    facilitatorBaseUrl: config.bazaarFacilitatorBaseUrl,
    kind: "sync_all",
  };
};

export const runWorkerFromEnvironment = async () => {
  return runWorkerJob(
    buildWorkerJobFromConfig(),
    createEmptyWorkerDependencies(),
  );
};

export const startWorkerReceiverFromEnvironment = async () => {
  const config = loadWorkerConfig(readEnvironment());
  const environment = readEnvironment();
  const redisUrl = environment.UPSTASH_REDIS_REST_URL ?? environment.KV_REST_API_URL;
  const redisToken =
    environment.UPSTASH_REDIS_REST_TOKEN ?? environment.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    throw new Error("Redis REST credentials are required for the worker receiver");
  }

  return startWorkerReceiverServer({
    dependencies: {
      idempotencyStore: createUpstashWorkerIdempotencyStore(redisUrl, redisToken),
      runJob: (payload) =>
        runWorkerJob(payload, createEmptyWorkerDependencies()),
      ...(config.qstash.currentSigningKey && config.qstash.nextSigningKey
        ? {
            verifier: createQstashRequestVerifier({
              currentSigningKey: config.qstash.currentSigningKey,
              nextSigningKey: config.qstash.nextSigningKey,
            }),
          }
        : {}),
    },
    port: config.receiverPort,
  });
};
