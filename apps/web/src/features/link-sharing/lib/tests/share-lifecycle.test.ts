import { describe, expect, test } from "vitest";

import { shareExpiryFormSchema } from "../share-lifecycle";

const now = () => Date.parse("2026-11-17T09:00:00Z");

describe("shareExpiryFormSchema", () => {
  test("a future wall time becomes the stored instant", () => {
    const parsed = shareExpiryFormSchema("UTC", now).safeParse({
      expiry: "2026-11-20T10:00",
    });
    expect(parsed.success && parsed.data.expiresAt).toBe(
      "2026-11-20T10:00:00.000Z",
    );
  });

  test("an empty value means no expiry", () => {
    const parsed = shareExpiryFormSchema("UTC", now).safeParse({ expiry: "" });
    expect(parsed.success && parsed.data.expiresAt).toBeNull();
  });

  test("a past time is refused with the future-time message", () => {
    const parsed = shareExpiryFormSchema("UTC", now).safeParse({
      expiry: "2026-11-01T10:00",
    });
    expect(!parsed.success && parsed.error.issues[0]?.message).toBe(
      "Choose a time in the future.",
    );
  });

  test("an impossible wall time is refused with the picker message", () => {
    const parsed = shareExpiryFormSchema("UTC", now).safeParse({
      expiry: "2026-02-31T10:00",
    });
    expect(!parsed.success && parsed.error.issues[0]?.message).toBe(
      "Enter a valid Time.",
    );
  });
});
