import type { NormalizedPaymentAttempt } from "./extension-parser.js";
import type {
  CreatePaymentEventInput,
  PaymentEventRecord,
  WalletRecord,
} from "../../db/repositories.js";

/**
 * Payment Event Repository interface (subset needed for persistence)
 */
export interface PaymentEventRepository {
  create(input: CreatePaymentEventInput): Promise<PaymentEventRecord>;
  findBySourceReference(
    source: string,
    sourceReference: string,
  ): Promise<PaymentEventRecord | null>;
}

/**
 * Wallet Repository interface (subset needed for persistence)
 */
export interface WalletRepository {
  upsert(input: {
    readonly address: string;
    readonly network: string;
  }): Promise<WalletRecord>;
  findByAddressAndNetwork(
    address: string,
    network: string,
  ): Promise<WalletRecord | null>;
}

/**
 * Repositories needed for attempt persistence
 */
export interface AttemptPersistenceRepositories {
  readonly wallets: WalletRepository;
  readonly paymentEvents: PaymentEventRepository;
}

/**
 * Result of attempt persistence operation
 */
export interface AttemptPersistenceResult {
  readonly action: "created" | "noop";
  readonly attemptId: string;
}

/**
 * Persist a normalized payment attempt to the database
 * Uses idempotent deduplication on (source='a2a_x402_receipt', taskId:attemptIndex)
 *
 * @param attempt Normalized payment attempt to persist
 * @param agentId ID of the agent (payer)
 * @param serviceId ID of the service (payee)
 * @param repositories Database repositories
 * @returns Persistence result with action and attempt ID
 * @throws Error if service wallet not found
 */
export const persistPaymentAttempt = async (
  attempt: NormalizedPaymentAttempt,
  agentId: string,
  serviceId: string,
  repositories: AttemptPersistenceRepositories,
): Promise<AttemptPersistenceResult> => {
  // 1. Upsert payer wallet (if payer address present)
  let payerWalletId: string | null = null;
  if (attempt.payer) {
    const payerWallet = await repositories.wallets.upsert({
      address: attempt.payer,
      network: attempt.network,
    });
    payerWalletId = payerWallet.id;
  }

  // 2. Find payTo wallet (must exist from service discovery)
  const payToWallet = await repositories.wallets.findByAddressAndNetwork(
    attempt.payTo,
    attempt.network,
  );

  if (!payToWallet) {
    throw new Error(
      `Service wallet not found: ${attempt.payTo} on ${attempt.network}. ` +
        `Ensure service has been ingested from Bazaar before processing receipts.`,
    );
  }

  // 3. Check idempotency: (source, taskId:attemptIndex)
  const sourceReference = `${attempt.taskId}:${attempt.attemptIndex}`;
  const existing = await repositories.paymentEvents.findBySourceReference(
    "a2a_x402_receipt",
    sourceReference,
  );

  if (existing) {
    return { action: "noop", attemptId: existing.id };
  }

  // 4. Determine confidence tier and score based on success/failure
  const confidenceTier = attempt.success
    ? "high"
    : attempt.errorReason
      ? "low" // Failed with error
      : "medium"; // Unknown outcome

  const confidenceScore = attempt.success
    ? 900
    : attempt.errorReason
      ? 300
      : 600;

  // 5. Insert payment event (represents one receipt attempt)
  const paymentEvent = await repositories.paymentEvents.create({
    agentId, // Direct FK from partner-provided agent identity
    serviceId, // Direct FK from partner-provided service identity
    txHash: attempt.transactionHash || sourceReference, // Synthetic if no tx
    network: attempt.network,
    asset: attempt.asset,
    amount: attempt.maxAmountRequired, // From requirements, not receipt
    observedAt: new Date(), // Current ingestion time
    blockNumber: null, // Receipts don't have block numbers
    payerWalletId,
    payToWalletId: payToWallet.id,
    attemptGroupId: attempt.taskId, // Group by task ID
    confidenceTier,
    confidenceScore,
    source: "a2a_x402_receipt",
    sourceReference, // KEY: taskId:attemptIndex for idempotency
  });

  return { action: "created", attemptId: paymentEvent.id };
};

/**
 * Persist multiple payment attempts in batch
 * Processes in parallel with error handling
 *
 * @param attempts Array of normalized payment attempts
 * @param agentId ID of the agent
 * @param serviceId ID of the service
 * @param repositories Database repositories
 * @returns Results and errors
 */
export const persistPaymentAttemptsBatch = async (
  attempts: readonly NormalizedPaymentAttempt[],
  agentId: string,
  serviceId: string,
  repositories: AttemptPersistenceRepositories,
): Promise<{
  readonly results: readonly AttemptPersistenceResult[];
  readonly errors: readonly { readonly attempt: NormalizedPaymentAttempt; readonly error: string }[];
}> => {
  const settled = await Promise.allSettled(
    attempts.map((attempt) =>
      persistPaymentAttempt(attempt, agentId, serviceId, repositories),
    ),
  );

  const results: AttemptPersistenceResult[] = [];
  const errors: { readonly attempt: NormalizedPaymentAttempt; readonly error: string }[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      errors.push({
        attempt: attempts[index]!,
        error: result.reason?.message ?? "Unknown error",
      });
    }
  });

  return { results, errors };
};
