import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createParser } from "../../src/core/parse-result.js";

describe("createParser", () => {
  it("returns normalized data when parsing succeeds", () => {
    const parser = createParser(
      z.object({
        value: z.string().min(1),
      }),
      (input) => input.value.toUpperCase(),
    );

    expect(parser({ value: "agent" })).toEqual({
      success: true,
      data: "AGENT",
    });
  });

  it("formats top-level schema failures against the input root", () => {
    const parser = createParser(
      z.string().min(3),
      (input) => input.toUpperCase(),
    );

    expect(parser("x")).toEqual({
      success: false,
      issues: ["input: Too small: expected string to have >=3 characters"],
    });
  });

  it("formats nested schema failures with dotted paths", () => {
    const parser = createParser(
      z.object({
        envelope: z.object({
          id: z.string().uuid(),
        }),
      }),
      (input) => input,
    );

    expect(parser({ envelope: { id: "not-a-uuid" } })).toEqual({
      success: false,
      issues: ["envelope.id: Invalid UUID"],
    });
  });
});
