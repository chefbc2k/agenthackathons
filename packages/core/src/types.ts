import { z } from "zod";

export const jobStatuses = [
  "intake",
  "confirmation_pending",
  "confirmed",
  "accepted",
  "executing",
  "receipt_submitted",
  "completed",
  "failed",
  "cancelled",
  "expired",
] as const;

export const checkpointSteps = [
  "discovery",
  "payee_name",
  "amount",
  "currency",
  "due_date",
  "memo",
  "payment_type",
  "summary_confirmed",
  "receipt_submitted",
] as const;

export const requesterTypes = ["human", "agent"] as const;
export const paymentChannels = ["telegram_dm"] as const;
export const paymentProviders = ["visa"] as const;
export const paymentTypes = ["invoice", "payment_link", "both"] as const;

export const JobStatusSchema = z.enum(jobStatuses);
export const CheckpointStepSchema = z.enum(checkpointSteps);
export const RequesterTypeSchema = z.enum(requesterTypes);
export const PaymentChannelSchema = z.enum(paymentChannels);
export const PaymentProviderSchema = z.enum(paymentProviders);
export const PaymentTypeSchema = z.enum(paymentTypes);

export type JobStatus = z.infer<typeof JobStatusSchema>;
export type CheckpointStep = z.infer<typeof CheckpointStepSchema>;
export type RequesterType = z.infer<typeof RequesterTypeSchema>;
export type PaymentType = z.infer<typeof PaymentTypeSchema>;

export const PaymentJobSchema = z.object({
  jobId: z.string().min(1),
  userHandle: z.string().min(1),
  requesterType: RequesterTypeSchema,
  channel: PaymentChannelSchema.default("telegram_dm"),
  providerType: PaymentProviderSchema.default("visa"),
  payeeName: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{2})?$/, "Amount must be a decimal string"),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memo: z.string().min(1).max(140),
  paymentType: PaymentTypeSchema,
  invoiceRequested: z.boolean().default(true),
  paymentLinkRequested: z.boolean().default(true),
  status: JobStatusSchema,
  deadline: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PaymentJob = z.infer<typeof PaymentJobSchema>;

export const CheckpointStateSchema = z.object({
  jobId: z.string().min(1),
  step: CheckpointStepSchema,
  normalizedPayload: z.record(z.string(), z.unknown()),
  checkpointHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  createdAt: z.string().datetime(),
});

export type CheckpointState = z.infer<typeof CheckpointStateSchema>;

export const VisaReceiptSchema = z.object({
  jobId: z.string().min(1),
  providerType: PaymentProviderSchema.default("visa"),
  invoiceId: z.string().optional(),
  paymentLinkId: z.string().optional(),
  providerReferenceId: z.string().min(1),
  status: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{2})?$/),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  createdAt: z.string().datetime(),
  artifactHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  invoiceUrl: z.string().url().optional(),
  paymentLinkUrl: z.string().url().optional(),
});

export type VisaReceipt = z.infer<typeof VisaReceiptSchema>;

export const ValidationResultSchema = z.object({
  jobId: z.string().min(1),
  schemaValid: z.boolean(),
  providerReferencePresent: z.boolean(),
  amountMatch: z.boolean(),
  terminalStatus: z.boolean(),
  notes: z.array(z.string()),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const ConversationDraftSchema = z.object({
  userHandle: z.string().min(1),
  requesterType: RequesterTypeSchema.default("human"),
  payeeName: z.string().optional(),
  amount: z.string().regex(/^\d+(\.\d{2})?$/).optional(),
  currency: z.string().length(3).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  memo: z.string().max(140).optional(),
  paymentType: PaymentTypeSchema.optional(),
});

export type ConversationDraft = z.infer<typeof ConversationDraftSchema>;

export const paymentCollectionOrder = [
  "payeeName",
  "amount",
  "currency",
  "dueDate",
  "memo",
  "paymentType",
] as const satisfies readonly (keyof ConversationDraft)[];

export type PaymentCollectionField = (typeof paymentCollectionOrder)[number];

export const paymentCollectionPrompts: Record<PaymentCollectionField, string> = {
  payeeName: "Who is the payee for this bill?",
  amount: "What amount should I pay? Use a decimal like 124.50.",
  currency: "What is the currency? Use a 3-letter code like USD.",
  dueDate: "What is the due date? Use YYYY-MM-DD.",
  memo: "What memo or reference should be attached to the payment?",
  paymentType: "Should I request an invoice, a payment link, or both?",
};

export const checkpointStepForField: Record<PaymentCollectionField, CheckpointStep> = {
  payeeName: "payee_name",
  amount: "amount",
  currency: "currency",
  dueDate: "due_date",
  memo: "memo",
  paymentType: "payment_type",
};

export const terminalStatuses = new Set<JobStatus>([
  "completed",
  "failed",
  "cancelled",
  "expired",
]);
