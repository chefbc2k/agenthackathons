import { describe, expect, it } from "vitest";

import { buildPaymentJobFromDraft, canConfirmDraft, getNextCollectionField } from "./conversation";
import { buildCheckpointHash, buildPaymentJobHash, buildReceiptHash } from "./hashes";

describe("conversation helpers", () => {
  it("identifies the next required field in order", () => {
    expect(getNextCollectionField({ userHandle: "chef", requesterType: "human" })).toBe("payeeName");
    expect(
      getNextCollectionField({
        userHandle: "chef",
        requesterType: "human",
        payeeName: "ComEd",
        amount: "124.50",
        currency: "USD",
        dueDate: "2026-03-31",
        memo: "March bill",
      }),
    ).toBe("paymentType");
  });

  it("builds a confirmed payment job from a complete draft", () => {
    const draft = {
      userHandle: "chef",
      requesterType: "human" as const,
      payeeName: "ComEd",
      amount: "124.50",
      currency: "usd",
      dueDate: "2026-03-31",
      memo: "March bill",
      paymentType: "both" as const,
    };

    expect(canConfirmDraft(draft)).toBe(true);

    const job = buildPaymentJobFromDraft({
      createdAt: "2026-03-13T10:00:00.000Z",
      deadline: 1_774_000_000,
      draft,
      jobId: "job_123",
      userHandle: "chef",
    });

    expect(job.currency).toBe("USD");
    expect(job.invoiceRequested).toBe(true);
    expect(job.paymentLinkRequested).toBe(true);
    expect(job.status).toBe("confirmed");
  });
});

describe("deterministic hashing", () => {
  it("produces stable hashes for the same job payload", () => {
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

    expect(buildPaymentJobHash(job)).toBe(buildPaymentJobHash({ ...job }));
  });

  it("changes checkpoint hashes when the payload changes", () => {
    const first = buildCheckpointHash({
      jobId: "job_123",
      step: "memo",
      normalizedPayload: { memo: "March bill" },
      createdAt: "2026-03-13T10:01:00.000Z",
    });

    const second = buildCheckpointHash({
      jobId: "job_123",
      step: "memo",
      normalizedPayload: { memo: "April bill" },
      createdAt: "2026-03-13T10:01:00.000Z",
    });

    expect(first).not.toBe(second);
  });

  it("produces a receipt hash from the canonical receipt payload", () => {
    const artifactHash = buildReceiptHash({
      jobId: "job_123",
      providerType: "visa",
      providerReferenceId: "visa-ref-123",
      status: "READY",
      amount: "124.50",
      currency: "USD",
      createdAt: "2026-03-13T10:03:00.000Z",
      invoiceId: "invoice-123",
      paymentLinkId: "plink-123",
      invoiceUrl: "https://example.com/invoice",
      paymentLinkUrl: "https://example.com/pay",
    });

    expect(artifactHash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
