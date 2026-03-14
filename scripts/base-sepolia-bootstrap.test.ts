import { describe, expect, it } from "vitest";

import {
  deriveBaseSepoliaRpcUrl,
  extractDeployedAddress,
  upsertEnvValue,
} from "./base-sepolia-bootstrap-lib.js";

describe("deriveBaseSepoliaRpcUrl", () => {
  it("derives the Base Sepolia endpoint from an Alchemy API key", () => {
    expect(deriveBaseSepoliaRpcUrl({ alchemyApiKey: "abc123" })).toBe(
      "https://base-sepolia.g.alchemy.com/v2/abc123",
    );
  });

  it("rewrites a Base Mainnet endpoint to Base Sepolia", () => {
    expect(
      deriveBaseSepoliaRpcUrl({
        rpcUrl: "https://base-mainnet.g.alchemy.com/v2/abc123",
      }),
    ).toBe("https://base-sepolia.g.alchemy.com/v2/abc123");
  });
});

describe("upsertEnvValue", () => {
  it("replaces an existing env var in place", () => {
    const content = "FOO=old\nBAR=value\n";
    expect(upsertEnvValue(content, "FOO", "new")).toBe("FOO=new\nBAR=value\n");
  });

  it("appends a new env var when it does not exist", () => {
    const content = "FOO=old\n";
    expect(upsertEnvValue(content, "BAR", "value")).toBe("FOO=old\nBAR=value\n");
  });
});

describe("extractDeployedAddress", () => {
  it("parses the registry address from forge output", () => {
    expect(
      extractDeployedAddress("PaymentJobRegistry deployed at 0x1234567890abcdef1234567890ABCDEF12345678"),
    ).toBe("0x1234567890abcdef1234567890ABCDEF12345678");
  });
});
