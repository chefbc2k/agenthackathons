import { loadWorkerConfig } from "../worker/config.js";
import { buildWorkerJobFromConfig } from "../worker/cli.js";
import {
  createQstashScheduleClient,
  ensureWorkerSchedule,
  type EnsureWorkerScheduleResult,
} from "./schedules.js";

const readEnvironment = (): Record<string, string | undefined> => {
  const runtime = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return runtime.process?.env ?? {};
};

export const ensureScheduleFromEnvironment = async (): Promise<EnsureWorkerScheduleResult> => {
  const config = loadWorkerConfig(readEnvironment());

  if (!config.qstash.token) {
    throw new Error("QSTASH_TOKEN is required to create schedules");
  }

  if (!config.qstash.destination || !config.qstash.scheduleCron) {
    throw new Error("QStash destination and schedule cron are required");
  }

  return ensureWorkerSchedule(
    {
      body: buildWorkerJobFromConfig(),
      cron: config.qstash.scheduleCron,
      destination: config.qstash.destination,
      method: "POST",
      scheduleId: "cross-agent-reputation-graph-sync",
    },
    createQstashScheduleClient(config.qstash.token),
  );
};
