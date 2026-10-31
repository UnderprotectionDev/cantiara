import {
  PERSONAL_DATA_ERROR_MESSAGES,
  type PersonalDataErrorCode,
} from "@cantiara/api/personal-data-rights";

/** The visible refusal text; an unknown failure is a plain retryable message. */
export function personalDataRefusalMessage(
  error: unknown,
  action:
    | "Export Personal Data"
    | "Erase Personal Data" = "Export Personal Data",
): string {
  const code = (error as { data?: { code?: unknown } } | null)?.data?.code;
  const known = (
    Object.keys(PERSONAL_DATA_ERROR_MESSAGES) as PersonalDataErrorCode[]
  ).find((candidate) => candidate === code);
  return known
    ? PERSONAL_DATA_ERROR_MESSAGES[known]
    : `${action} could not be completed. Try again.`;
}
