import { describe, expect, it } from "vitest";

import { hashStableJson, stableStringify } from "../../src/core/stable-json.js";

describe("stableStringify", () => {
  it("sorts object keys deterministically", () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("preserves array order while normalizing nested objects", () => {
    expect(stableStringify([{ b: 2, a: 1 }, "x"])).toBe('[{"a":1,"b":2},"x"]');
  });
});

describe("hashStableJson", () => {
  it("hashes equivalent objects identically", () => {
    expect(hashStableJson({ b: 2, a: 1 })).toBe(hashStableJson({ a: 1, b: 2 }));
  });

  it("changes when the payload changes", () => {
    expect(hashStableJson({ a: 1 })).not.toBe(hashStableJson({ a: 2 }));
  });
});
