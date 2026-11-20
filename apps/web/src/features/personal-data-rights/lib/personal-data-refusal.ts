import type {
  ERASE_PERSONAL_DATA_LABEL,
  EXPORT_PERSONAL_DATA_LABEL,
} from "@cantiara/api/personal-data-rights";

import { personalDataErrors } from "@cantiara/api/personal-data-rights-rpc-errors";
import { isDefinedError, ORPCError } from "@orpc/client";

export type PersonalDataAction =
  | typeof EXPORT_PERSONAL_DATA_LABEL
  | typeof ERASE_PERSONAL_DATA_LABEL;

/** The visible refusal text; an unknown failure is a plain retryable message. */
export function personalDataRefusalMessage(
  error: unknown,
  action: PersonalDataAction,
): string {
  if (
    error instanceof ORPCError &&
    isDefinedError(error) &&
    Object.hasOwn(personalDataErrors, error.code)
  ) {
    return personalDataErrors[error.code as keyof typeof personalDataErrors]
      .message;
  }
  return `${action} could not be completed. Try again.`;
}
