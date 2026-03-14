import { describe, expect, it } from "vitest";

describe("base sepolia test-wallet script contract", () => {
  it("documents the intended output env format", () => {
    const lines = [
      "TEST_WALLET_1_ADDRESS=0x1111111111111111111111111111111111111111",
      "TEST_WALLET_1_PRIVATE_KEY=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "TEST_WALLET_1_FUNDING_TX=0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ];

    expect(lines[0]).toMatch(/^TEST_WALLET_1_ADDRESS=0x[a-fA-F0-9]{40}$/);
    expect(lines[1]).toMatch(/^TEST_WALLET_1_PRIVATE_KEY=0x[a-fA-F0-9]{64}$/);
    expect(lines[2]).toMatch(/^TEST_WALLET_1_FUNDING_TX=0x[a-fA-F0-9]{64}$/);
  });
});
