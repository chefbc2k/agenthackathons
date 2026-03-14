import { buildPaymentJobFromDraft } from "@accord/core";
import { describe, expect, it } from "vitest";

import { formatProofPackage } from "./messages";
import { validateVisaReceipt } from "./validation";
import { executeVisaPaymentJob } from "./visa";

describe("Visa execution", () => {
  it("normalizes invoice and payment-link provider responses", async () => {
    const job = buildPaymentJobFromDraft({
      createdAt: "2026-03-13T10:00:00.000Z",
      deadline: 1_774_000_000,
      draft: {
        userHandle: "chef",
        requesterType: "human",
        payeeName: "ComEd",
        amount: "124.50",
        currency: "USD",
        dueDate: "2026-03-31",
        memo: "March bill",
        paymentType: "both",
      },
      jobId: "job_123",
      userHandle: "chef",
    });

    const receipt = await executeVisaPaymentJob({
      config: {
        merchantId: "merchant",
        apiKeyId: "key",
        secretKey: "secret",
        environment: "SANDBOX",
      },
      job,
      toolkit: {
        createInvoice() {
          return Promise.resolve({
            id: "invoice-123",
            status: "READY",
            href: "https://visa.example/invoice-123",
          });
        },
        createPaymentLink() {
          return Promise.resolve({
            id: "plink-123",
            status: "READY",
            link: "https://visa.example/plink-123",
          });
        },
      },
      now: new Date("2026-03-13T10:04:00.000Z"),
    });

    expect(receipt.invoiceId).toBe("invoice-123");
    expect(receipt.paymentLinkId).toBe("plink-123");
    expect(receipt.artifactHash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});

describe("receipt validation", () => {
  it("fails validation when amount mismatches", () => {
    const job = buildPaymentJobFromDraft({
      createdAt: "2026-03-13T10:00:00.000Z",
      deadline: 1_774_000_000,
      draft: {
        userHandle: "chef",
        requesterType: "human",
        payeeName: "ComEd",
        amount: "124.50",
        currency: "USD",
        dueDate: "2026-03-31",
        memo: "March bill",
        paymentType: "both",
      },
      jobId: "job_123",
      userHandle: "chef",
    });

    const result = validateVisaReceipt(job, {
      jobId: "job_123",
      providerType: "visa",
      providerReferenceId: "ref-123",
      status: "READY",
      amount: "125.50",
      currency: "USD",
      createdAt: "2026-03-13T10:03:00.000Z",
      artifactHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    });

    expect(result.amountMatch).toBe(false);
    expect(result.notes).toContain("Receipt amount or currency does not match the confirmed job.");
  });

  it("formats the DM proof package", () => {
    const job = buildPaymentJobFromDraft({
      createdAt: "2026-03-13T10:00:00.000Z",
      deadline: 1_774_000_000,
      draft: {
        userHandle: "chef",
        requesterType: "human",
        payeeName: "ComEd",
        amount: "124.50",
        currency: "USD",
        dueDate: "2026-03-31",
        memo: "March bill",
        paymentType: "both",
      },
      jobId: "job_123",
      userHandle: "chef",
    });

    const message = formatProofPackage({
      explorerUrl: "https://sepolia.basescan.org/tx/0xabc",
      job,
      receipt: {
        jobId: "job_123",
        providerType: "visa",
        providerReferenceId: "ref-123",
        status: "READY",
        amount: "124.50",
        currency: "USD",
        createdAt: "2026-03-13T10:03:00.000Z",
        artifactHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        paymentLinkUrl: "https://visa.example/plink-123",
      },
      validation: {
        jobId: "job_123",
        schemaValid: true,
        providerReferencePresent: true,
        amountMatch: true,
        terminalStatus: true,
        notes: [],
      },
    });

    expect(message).toContain("Provider reference: ref-123");
    expect(message).toContain("Explorer: https://sepolia.basescan.org/tx/0xabc");
  });
});
