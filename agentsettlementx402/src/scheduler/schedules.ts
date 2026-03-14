import { Client } from "@upstash/qstash";

import { type WorkerJobPayload } from "../worker/orchestrator.js";

export interface WorkerScheduleDefinition {
  readonly body: WorkerJobPayload;
  readonly cron: string;
  readonly destination: string;
  readonly method: "POST";
  readonly scheduleId: string;
}

export interface WorkerScheduleRecord {
  readonly body: string | null;
  readonly cron: string;
  readonly destination: string;
  readonly method: string | null;
  readonly scheduleId: string;
}

export interface WorkerScheduleClient {
  create(definition: {
    readonly body: string;
    readonly cron: string;
    readonly destination: string;
    readonly method: "POST";
    readonly scheduleId: string;
  }): Promise<{ scheduleId: string }>;
  delete(scheduleId: string): Promise<void>;
  get(scheduleId: string): Promise<WorkerScheduleRecord | null>;
}

export interface EnsureWorkerScheduleResult {
  readonly action: "created" | "noop" | "updated";
  readonly scheduleId: string;
}

const scheduleMatches = (
  existing: WorkerScheduleRecord,
  desired: WorkerScheduleDefinition,
  serializedBody: string,
): boolean => {
  return (
    existing.cron === desired.cron &&
    existing.destination === desired.destination &&
    (existing.method ?? "POST") === desired.method &&
    (existing.body ?? "") === serializedBody
  );
};

export const ensureWorkerSchedule = async (
  definition: WorkerScheduleDefinition,
  client: WorkerScheduleClient,
): Promise<EnsureWorkerScheduleResult> => {
  const serializedBody = JSON.stringify(definition.body);
  const existing = await client.get(definition.scheduleId);

  if (!existing) {
    await client.create({
      ...definition,
      body: serializedBody,
    });

    return {
      action: "created",
      scheduleId: definition.scheduleId,
    };
  }

  if (scheduleMatches(existing, definition, serializedBody)) {
    return {
      action: "noop",
      scheduleId: definition.scheduleId,
    };
  }

  await client.delete(definition.scheduleId);
  await client.create({
    ...definition,
    body: serializedBody,
  });

  return {
    action: "updated",
    scheduleId: definition.scheduleId,
  };
};

export const createQstashScheduleClient = (
  token: string,
): WorkerScheduleClient => {
  const client = new Client({
    token,
  });

  return {
    create: async (definition) => {
      const result = await client.schedules.create({
        body: definition.body,
        cron: definition.cron,
        destination: definition.destination,
        method: definition.method,
        scheduleId: definition.scheduleId,
      });

      return {
        scheduleId: result.scheduleId,
      };
    },
    delete: async (scheduleId) => {
      await client.schedules.delete(scheduleId);
    },
    get: async (scheduleId) => {
      try {
        const result = await client.schedules.get(scheduleId);

        return {
          body: typeof result.body === "string" ? result.body : null,
          cron: result.cron,
          destination: result.destination,
          method: result.method ?? null,
          scheduleId: result.scheduleId,
        };
      } catch {
        return null;
      }
    },
  };
};
