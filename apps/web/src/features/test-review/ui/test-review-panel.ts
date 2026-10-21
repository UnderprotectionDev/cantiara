import { useEffect, useRef } from "react";

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

/** Moves focus to the heading of a panel that just opened, for keyboard and screen readers. */
export function usePanelFocus(open: boolean) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) {
      ref.current?.focus();
    }
  }, [open]);
  return ref;
}
