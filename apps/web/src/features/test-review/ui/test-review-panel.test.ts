import { describe, expect, test } from "vitest";
import { followUpWorkId } from "./test-review-panel";

describe("Test Review panel helpers", () => {
  test("the follow-up Work id is derived from the preview fingerprint alone", () => {
    const fingerprint = "a".repeat(64);
    expect(followUpWorkId(fingerprint)).toBe(
      `test-review-follow-up-${fingerprint}`,
    );
    // A retried commit of the same preview reuses the same Work identity,
    // so the server-side idempotency key makes the retry a no-op.
    expect(followUpWorkId(fingerprint)).toBe(followUpWorkId(fingerprint));
    expect(followUpWorkId("b".repeat(64))).not.toBe(
      followUpWorkId(fingerprint),
    );
  });
});
