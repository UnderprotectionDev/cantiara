import {
  EXPORT_ERROR_CODES,
  EXPORT_ERROR_MESSAGES,
  type ExportErrorCode,
} from "@cantiara/api/data-export";

/** Reads the stable Selected Export refusal code off an oRPC error. */
export function exportRefusalCode(error: unknown): ExportErrorCode | null {
  const code = (error as { data?: { code?: unknown } } | null)?.data?.code;
  return EXPORT_ERROR_CODES.find((candidate) => candidate === code) ?? null;
}

/** The visible refusal text; an unknown failure is a plain retryable message. */
export function exportRefusalMessage(error: unknown): string {
  const code = exportRefusalCode(error);
  return code
    ? EXPORT_ERROR_MESSAGES[code]
    : "Export could not be completed. Try again.";
}

/**
 * A selection the request schema refuses locally never reaches the preview,
 * so the form shows its own refusal: a too-long record-id list keeps the
 * server's limit wording, anything else reads as an unusable selection.
 */
export function exportSelectionRefusal(error: {
  issues: ReadonlyArray<{ path: readonly PropertyKey[] }>;
}): string {
  const rowsOverLimit = error.issues.some(
    (issue) => issue.path[0] === "recordIds",
  );
  return rowsOverLimit
    ? EXPORT_ERROR_MESSAGES.limit_exceeded
    : "Preview could not be built. Check the selection and try again.";
}
