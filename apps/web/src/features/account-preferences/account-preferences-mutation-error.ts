import {
  type AccountPreferences,
  accountPreferencesSchema,
} from "@cantiara/api/account-preferences";

export type AccountPreferencesMutationError =
  | { code: "CONFLICT" }
  | {
      code: "STALE_BASE_REVISION";
      currentRevision: number;
      currentValue: AccountPreferences;
    }
  | { code: "UNKNOWN" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseAccountPreferencesMutationError(
  error: unknown,
): AccountPreferencesMutationError {
  if (!isRecord(error)) {
    return { code: "UNKNOWN" };
  }

  const data = isRecord(error.data) ? error.data : error;
  if (data.code === "CONFLICT") {
    return { code: "CONFLICT" };
  }

  const currentValue = accountPreferencesSchema.safeParse(data.currentValue);
  if (
    data.code === "STALE_BASE_REVISION" &&
    typeof data.currentRevision === "number" &&
    Number.isSafeInteger(data.currentRevision) &&
    data.currentRevision >= 0 &&
    currentValue.success
  ) {
    return {
      code: "STALE_BASE_REVISION",
      currentRevision: data.currentRevision,
      currentValue: currentValue.data,
    };
  }

  return { code: "UNKNOWN" };
}

export function accountPreferencesMutationErrorMessage(
  error: AccountPreferencesMutationError,
) {
  switch (error.code) {
    case "CONFLICT":
      return "Conflict";
    case "STALE_BASE_REVISION":
      return "Current value";
    default:
      return "Preferences could not be saved.";
  }
}
