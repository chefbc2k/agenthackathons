import crypto from "node:crypto";

import stableStringify from "json-stable-stringify";

import type { CheckpointState, PaymentJob, VisaReceipt } from "./types";

export function canonicalize(value: unknown): string {
  return stableStringify(value) ?? "null";
}

export function sha256Hex(value: unknown): `0x${string}` {
  const payload = typeof value === "string" ? value : canonicalize(value);
  return `0x${crypto.createHash("sha256").update(payload).digest("hex")}`;
}

export function buildPaymentJobHash(job: PaymentJob): `0x${string}` {
  return sha256Hex({
    jobId: job.jobId,
    userHandle: job.userHandle,
    requesterType: job.requesterType,
    channel: job.channel,
    providerType: job.providerType,
    payeeName: job.payeeName,
    amount: job.amount,
    currency: job.currency,
    dueDate: job.dueDate,
    memo: job.memo,
    paymentType: job.paymentType,
    invoiceRequested: job.invoiceRequested,
    paymentLinkRequested: job.paymentLinkRequested,
    deadline: job.deadline,
  });
}

export function buildCheckpointHash(checkpoint: Omit<CheckpointState, "checkpointHash">): `0x${string}` {
  return sha256Hex({
    jobId: checkpoint.jobId,
    step: checkpoint.step,
    normalizedPayload: checkpoint.normalizedPayload,
    createdAt: checkpoint.createdAt,
  });
}

export function buildReceiptHash(receipt: Omit<VisaReceipt, "artifactHash">): `0x${string}` {
  return sha256Hex({
    jobId: receipt.jobId,
    providerType: receipt.providerType,
    invoiceId: receipt.invoiceId,
    paymentLinkId: receipt.paymentLinkId,
    providerReferenceId: receipt.providerReferenceId,
    status: receipt.status,
    amount: receipt.amount,
    currency: receipt.currency,
    createdAt: receipt.createdAt,
    invoiceUrl: receipt.invoiceUrl,
    paymentLinkUrl: receipt.paymentLinkUrl,
  });
}
