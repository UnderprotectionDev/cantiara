/** The thrown message when there is one, else the screen's own fallback. */
export function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
