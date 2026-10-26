export function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Retry-safe identity of the one new follow-up Work: the same preview always
 * derives the same Work id, so a retried commit hits the same server-side
 * idempotency key and creates nothing new.
 */
export function followUpWorkId(fingerprint: string) {
  return `test-review-follow-up-${fingerprint}`;
}
