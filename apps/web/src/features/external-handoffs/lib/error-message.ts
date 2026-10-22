export function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "This handoff could not be written.";
}
