import { useEffect, useRef } from "react";

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
