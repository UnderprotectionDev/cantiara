import { useEffect, useRef } from "react";

export function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
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
