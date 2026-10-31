import {
  type ERASE_PERSONAL_DATA_LABEL,
  type EXPORT_PERSONAL_DATA_LABEL,
  isPersonalDataErrorCode,
  PERSONAL_DATA_ERROR_MESSAGES,
} from "@cantiara/api/personal-data-rights";

export type PersonalDataAction =
  | typeof EXPORT_PERSONAL_DATA_LABEL
  | typeof ERASE_PERSONAL_DATA_LABEL;

/** The visible refusal text; an unknown failure is a plain retryable message. */
export function personalDataRefusalMessage(
  error: unknown,
  action: PersonalDataAction,
): string {
  const code = (error as { data?: { code?: unknown } } | null)?.data?.code;
  return isPersonalDataErrorCode(code)
    ? PERSONAL_DATA_ERROR_MESSAGES[code]
    : `${action} could not be completed. Try again.`;
}
