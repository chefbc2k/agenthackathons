import {
  ConversationDraftSchema,
  PaymentJobSchema,
  checkpointStepForField,
  paymentCollectionOrder,
  paymentCollectionPrompts,
  type CheckpointStep,
  type ConversationDraft,
  type PaymentCollectionField,
  type PaymentJob,
  type RequesterType,
} from "./types";

export function getNextCollectionField(draft: ConversationDraft): PaymentCollectionField | null {
  const parsed = ConversationDraftSchema.parse(draft);

  for (const field of paymentCollectionOrder) {
    if (!parsed[field]) {
      return field;
    }
  }

  return null;
}

export function getPromptForNextField(draft: ConversationDraft): string | null {
  const field = getNextCollectionField(draft);
  return field ? paymentCollectionPrompts[field] : null;
}

export function getCheckpointStep(field: PaymentCollectionField): CheckpointStep {
  return checkpointStepForField[field];
}

export function canConfirmDraft(draft: ConversationDraft): boolean {
  return getNextCollectionField(draft) === null;
}

export function buildPaymentJobFromDraft(args: {
  createdAt: string;
  deadline: number;
  jobId: string;
  requesterType?: RequesterType;
  userHandle: string;
  draft: ConversationDraft;
}): PaymentJob {
  const parsed = ConversationDraftSchema.parse(args.draft);

  if (!canConfirmDraft(parsed)) {
    throw new Error("Conversation draft is incomplete");
  }

  return PaymentJobSchema.parse({
    jobId: args.jobId,
    userHandle: args.userHandle,
    requesterType: args.requesterType ?? parsed.requesterType ?? "human",
    channel: "telegram_dm",
    providerType: "visa",
    payeeName: parsed.payeeName,
    amount: parsed.amount,
    currency: parsed.currency?.toUpperCase(),
    dueDate: parsed.dueDate,
    memo: parsed.memo,
    paymentType: parsed.paymentType,
    invoiceRequested: parsed.paymentType === "invoice" || parsed.paymentType === "both",
    paymentLinkRequested: parsed.paymentType === "payment_link" || parsed.paymentType === "both",
    status: "confirmed",
    deadline: args.deadline,
    createdAt: args.createdAt,
    updatedAt: args.createdAt,
  });
}
