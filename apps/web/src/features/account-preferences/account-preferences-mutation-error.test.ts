import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { describe, expect, test } from "vitest";

import {
  accountPreferencesMutationErrorMessage,
  parseAccountPreferencesMutationError,
} from "./account-preferences-mutation-error";

describe("Account Preferences mutation errors", () => {
  test("parses a Conflict response", () => {
    const parsed = parseAccountPreferencesMutationError({
      data: { code: "CONFLICT", label: "Conflict" },
    });

    expect(parsed).toEqual({ code: "CONFLICT" });
    expect(accountPreferencesMutationErrorMessage(parsed)).toBe("Conflict");
  });

  test("parses a stale response with the current value", () => {
    const parsed = parseAccountPreferencesMutationError({
      data: {
        code: "STALE_BASE_REVISION",
        currentRevision: 4,
        currentValue: { ...DEFAULT_ACCOUNT_PREFERENCES, appearance: "Light" },
        label: "Current value",
      },
    });

    expect(parsed).toEqual({
      code: "STALE_BASE_REVISION",
      currentRevision: 4,
      currentValue: { ...DEFAULT_ACCOUNT_PREFERENCES, appearance: "Light" },
    });
    expect(accountPreferencesMutationErrorMessage(parsed)).toBe(
      "Current value",
    );
  });

  test("does not trust an invalid current value", () => {
    const parsed = parseAccountPreferencesMutationError({
      data: {
        code: "STALE_BASE_REVISION",
        currentRevision: 4,
        currentValue: { ...DEFAULT_ACCOUNT_PREFERENCES, timeZone: "secret" },
      },
    });

    expect(parsed).toEqual({ code: "UNKNOWN" });
    expect(accountPreferencesMutationErrorMessage(parsed)).toBe(
      "Preferences could not be saved.",
    );
  });
});
