import type { PaymentJob, ValidationResult, VisaReceipt } from "@accord/core";

export function formatConfirmationSummary(job: PaymentJob): string {
  return [
    "Please confirm this bill-pay request:",
    `Payee: ${job.payeeName}`,
    `Amount: ${job.amount} ${job.currency}`,
    `Due date: ${job.dueDate}`,
    `Memo: ${job.memo}`,
    `Payment mode: ${job.paymentType}`,
    "Reply CONFIRM to proceed or CANCEL to stop.",
  ].join("\n");
}

export function formatProofPackage(args: {
  explorerUrl: string;
  job: PaymentJob;
  receipt: VisaReceipt;
  validation: ValidationResult;
}): string {
  const link = args.receipt.paymentLinkUrl ?? args.receipt.invoiceUrl ?? "Unavailable";

  return [
    `Accord Pay job ${args.job.jobId} is ${args.job.status}.`,
    `Provider reference: ${args.receipt.providerReferenceId}`,
    `Invoice/payment link: ${link}`,
    `Receipt hash: ${args.receipt.artifactHash}`,
    `Validation checks passed: ${args.validation.notes.length === 0 ? "yes" : "no"}`,
    `Explorer: ${args.explorerUrl}`,
  ].join("\n");
}
