import {
  type NormalizedPaymentAttempt,
  normalizePaymentAttempts,
  parseA2aX402Metadata,
} from "./extension-parser.js";

/**
 * Partner Pull Mode Configuration
 * Used when we have authorization to call A2A Task APIs (GetTask, ListTasks)
 */
export interface PartnerPullConfig {
  readonly agentBaseUrl: string;
  readonly authToken: string; // Bearer token for API authentication
  readonly pageSize?: number; // Optional, defaults to 100
}

/**
 * A2A Task response (simplified)
 * Actual spec may include more fields
 */
export interface A2aTaskResponse {
  readonly id: string;
  readonly contextId?: string;
  readonly metadata?: unknown;
  readonly status?: string;
  readonly createdAt?: string;
}

/**
 * A2A ListTasks response
 */
export interface A2aListTasksResponse {
  readonly items: readonly A2aTaskResponse[];
  readonly hasMore?: boolean;
  readonly nextCursor?: string;
}

/**
 * Pull receipts from partner agent via A2A Task APIs
 * Requires authorized access to agent's task endpoints
 *
 * @param config Partner configuration with auth token
 * @returns Normalized payment attempts from all tasks with x402 metadata
 */
export const pullReceiptsFromPartner = async (
  config: PartnerPullConfig,
): Promise<readonly NormalizedPaymentAttempt[]> => {
  const attempts: NormalizedPaymentAttempt[] = [];
  const pageSize = config.pageSize ?? 100;

  try {
    // 1. Call ListTasks with authentication
    const response = await fetch(
      `${config.agentBaseUrl}/tasks?pageSize=${pageSize}`,
      {
        headers: {
          Authorization: `Bearer ${config.authToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch tasks: ${response.status} ${response.statusText}`,
      );
    }

    const tasksData = (await response.json()) as A2aListTasksResponse;

    // 2. For each task, extract x402.payment metadata
    for (const task of tasksData.items) {
      if (!task.metadata) {
        continue;
      }

      // 3. Parse x402 metadata
      const parseResult = parseA2aX402Metadata(task.metadata);
      if (!parseResult.success) {
        // Skip tasks without valid x402 metadata
        continue;
      }

      const metadata = parseResult.data;

      // 4. Skip if no receipts
      if (metadata.receipts.length === 0) {
        continue;
      }

      // 5. Normalize receipts into attempts
      const taskAttempts = normalizePaymentAttempts(
        task.id,
        task.contextId ?? null,
        metadata,
      );

      attempts.push(...taskAttempts);
    }

    return attempts;
  } catch (error) {
    throw new Error(
      `Failed to pull receipts from ${config.agentBaseUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Pull receipts from multiple partner agents
 *
 * @param configs Array of partner configurations
 * @returns All normalized payment attempts from all partners
 */
export const pullReceiptsFromMultiplePartners = async (
  configs: readonly PartnerPullConfig[],
): Promise<readonly NormalizedPaymentAttempt[]> => {
  const results = await Promise.allSettled(
    configs.map((config) => pullReceiptsFromPartner(config)),
  );

  const allAttempts: NormalizedPaymentAttempt[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allAttempts.push(...result.value);
    } else {
      errors.push(result.reason?.message ?? "Unknown error");
    }
  }

  if (errors.length > 0) {
    console.warn(
      `Errors pulling receipts from ${errors.length} partners:`,
      errors,
    );
  }

  return allAttempts;
};
