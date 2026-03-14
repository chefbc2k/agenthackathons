import { z } from "zod";

export const VisaRuntimeConfigSchema = z.object({
  merchantId: z.string().min(1),
  apiKeyId: z.string().min(1),
  secretKey: z.string().min(1),
  environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
});

export type VisaRuntimeConfig = z.infer<typeof VisaRuntimeConfigSchema>;

export interface VisaToolkitLike {
  createInvoice(args: Record<string, unknown>): Promise<unknown>;
  createPaymentLink(args: Record<string, unknown>): Promise<unknown>;
}
