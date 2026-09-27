import { describe, expect, it } from "vitest";

import { assertBaseHistory } from "./base-history";

describe("development base migration history", () => {
  it("requires the exact current main migration times and SQL hashes", () => {
    const expected = [
      { created_at: "100", hash: "first" },
      { created_at: "200", hash: "second" },
    ];
    expect(() => assertBaseHistory(expected, expected)).not.toThrow();
    expect(() => assertBaseHistory(expected.slice(0, 1), expected)).toThrow();
    expect(() =>
      assertBaseHistory(
        [...expected, { created_at: "300", hash: "extra" }],
        expected,
      ),
    ).toThrow();
    expect(() =>
      assertBaseHistory(
        [{ created_at: "100", hash: "wrong" }, expected[1]],
        expected,
      ),
    ).toThrow();
  });
});
