import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useCallback } from "react";

/** Controls inline panels that must also close after a command or explicit Cancel. */
export function useCollapsibleState(initialOpen = false) {
  const store = useCreateStore<boolean>(initialOpen);
  const open = useSelector(store);
  const setOpen = useCallback(
    (next: boolean) => store.setState(() => next),
    [store],
  );
  return [open, setOpen] as const;
}
