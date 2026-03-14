import { buildReceiptHash, type PaymentJob, type VisaReceipt } from "@accord/core";

import { VisaRuntimeConfigSchema, type VisaRuntimeConfig, type VisaToolkitLike } from "./types";

type VisaToolExecutor = {
  execute: (args: Record<string, unknown>, options?: unknown) => PromiseLike<unknown>;
};

function buildInvoicePayload(job: PaymentJob) {
  return {
    invoice_number: job.jobId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18),
    totalAmount: job.amount,
    currency: job.currency,
    customerName: `@${job.userHandle}`,
    invoiceInformation: {
      description: job.memo.slice(0, 50),
      dueDate: job.dueDate,
      sendImmediately: false,
      deliveryMode: "none",
    },
  };
}

function buildPaymentLinkPayload(job: PaymentJob) {
  return {
    linkType: "PURCHASE",
    purchaseNumber: job.jobId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18),
    currency: job.currency,
    totalAmount: job.amount,
    requestPhone: false,
    requestShipping: false,
    clientReferenceCode: job.jobId,
    lineItems: [
      {
        productName: job.payeeName,
        productDescription: job.memo,
        quantity: "1",
        unitPrice: job.amount,
      },
    ],
  };
}

export async function createVisaToolkit(config: VisaRuntimeConfig): Promise<VisaToolkitLike> {
  const parsed = VisaRuntimeConfigSchema.parse(config);

  process.env.VISA_ACCEPTANCE_MERCHANT_ID = parsed.merchantId;
  process.env.VISA_ACCEPTANCE_API_KEY_ID = parsed.apiKeyId;
  process.env.VISA_ACCEPTANCE_SECRET_KEY = parsed.secretKey;

  const visaSdk = await import("@visaacceptance/agent-toolkit/ai-sdk");
  const { VisaAcceptanceAgentToolkit } = visaSdk;

  const toolkit = new VisaAcceptanceAgentToolkit(parsed.merchantId, parsed.apiKeyId, parsed.secretKey, parsed.environment, {
    actions: {
      invoices: {
        create: true,
      },
      paymentLinks: {
        create: true,
      },
    },
  });

  const tools = toolkit.getTools() as unknown as Record<string, VisaToolExecutor>;
  const createInvoiceTool = tools.create_invoice;
  const createPaymentLinkTool = tools.create_payment_link;

  if (!createInvoiceTool?.execute || !createPaymentLinkTool?.execute) {
    throw new Error("Visa toolkit did not expose the expected invoice/payment-link tools");
  }

  return {
    async createInvoice(args) {
      return createInvoiceTool.execute(args);
    },
    async createPaymentLink(args) {
      return createPaymentLinkTool.execute(args);
    },
  };
}

function extractInvoiceId(result: Record<string, unknown>): string | undefined {
  const nested = result.id ?? result.invoiceId ?? (result.submitTimeUtc as string | undefined);
  return typeof nested === "string" ? nested : undefined;
}

function extractPaymentLinkId(result: Record<string, unknown>): string | undefined {
  const nested = result.id ?? result.paymentLinkId ?? result.submitTimeUtc;
  return typeof nested === "string" ? nested : undefined;
}

function extractUrl(result: Record<string, unknown>): string | undefined {
  const candidate = result.link ?? result.paymentLink ?? result.href;
  return typeof candidate === "string" ? candidate : undefined;
}

export async function executeVisaPaymentJob(args: {
  config: VisaRuntimeConfig;
  job: PaymentJob;
  toolkit?: VisaToolkitLike;
  now?: Date;
}): Promise<VisaReceipt> {
  const toolkit = args.toolkit ?? (await createVisaToolkit(args.config));
  const createdAt = (args.now ?? new Date()).toISOString();

  const invoiceResult = args.job.invoiceRequested
    ? await toolkit.createInvoice(buildInvoicePayload(args.job))
    : undefined;
  const paymentLinkResult = args.job.paymentLinkRequested
    ? await toolkit.createPaymentLink(buildPaymentLinkPayload(args.job))
    : undefined;

  const normalizedInvoice = typeof invoiceResult === "object" && invoiceResult ? invoiceResult as Record<string, unknown> : undefined;
  const normalizedPaymentLink =
    typeof paymentLinkResult === "object" && paymentLinkResult ? paymentLinkResult as Record<string, unknown> : undefined;

  const receiptBase = {
    jobId: args.job.jobId,
    providerType: "visa" as const,
    invoiceId: normalizedInvoice ? extractInvoiceId(normalizedInvoice) : undefined,
    paymentLinkId: normalizedPaymentLink ? extractPaymentLinkId(normalizedPaymentLink) : undefined,
    providerReferenceId:
      (normalizedInvoice?.id as string | undefined) ??
      (normalizedPaymentLink?.id as string | undefined) ??
      args.job.jobId,
    status:
      typeof normalizedInvoice?.status === "string"
        ? normalizedInvoice.status
        : typeof normalizedPaymentLink?.status === "string"
          ? normalizedPaymentLink.status
          : "READY",
    amount: args.job.amount,
    currency: args.job.currency,
    createdAt,
    invoiceUrl: normalizedInvoice ? extractUrl(normalizedInvoice) : undefined,
    paymentLinkUrl: normalizedPaymentLink ? extractUrl(normalizedPaymentLink) : undefined,
  };

  return {
    ...receiptBase,
    artifactHash: buildReceiptHash(receiptBase),
  };
}
