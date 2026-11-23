"use client";

import { createContext, useContext, useLayoutEffect } from "react";

export const RowRetentionContext = createContext<(() => () => void) | null>(
  null,
);

/** Keep an active editor mounted through every virtual list that contains it. */
export function useRetainVirtualRow(active: boolean) {
  const retain = useContext(RowRetentionContext);
  useLayoutEffect(() => (active ? retain?.() : undefined), [active, retain]);
}
