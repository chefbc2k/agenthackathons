import { ValidationResultSchema, VisaReceiptSchema, type PaymentJob, type ValidationResult, type VisaReceipt } from "@accord/core";

const terminalProviderStatuses = new Set(["READY", "SENT", "COMPLETED", "PENDING_PAYMENT"]);

export function validateVisaReceipt(job: PaymentJob, receipt: VisaReceipt): ValidationResult {
  const schemaValid = VisaReceiptSchema.safeParse(receipt).success;
  const providerReferencePresent = Boolean(receipt.providerReferenceId);
  const amountMatch = receipt.amount === job.amount && receipt.currency === job.currency;
  const terminalStatus = terminalProviderStatuses.has(receipt.status.toUpperCase());

  const notes: string[] = [];
  if (!schemaValid) {
    notes.push("Receipt does not match the canonical VisaReceipt schema.");
  }
  if (!providerReferencePresent) {
    notes.push("Provider reference is missing.");
  }
  if (!amountMatch) {
    notes.push("Receipt amount or currency does not match the confirmed job.");
  }
  if (!terminalStatus) {
    notes.push(`Provider status ${receipt.status} is not terminal/usable.`);
  }

  return ValidationResultSchema.parse({
    jobId: job.jobId,
    schemaValid,
    providerReferencePresent,
    amountMatch,
    terminalStatus,
    notes,
  });
}
