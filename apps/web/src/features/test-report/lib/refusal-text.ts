/** A refusal's explanation plus the safe field path; it never carries payload values. */
export function refusalText(error: unknown, fallback: string) {
  if (!(error instanceof Error && error.message)) {
    return fallback;
  }
  const { data } = error as { data?: { fieldPath?: unknown } };
  return typeof data?.fieldPath === "string"
    ? `${error.message} Field: ${data.fieldPath}.`
    : error.message;
}
