import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useLayoutEffect } from "react";

type CopyFeedback<T> =
  | { status: "idle" }
  | { status: "copying" }
  | { status: "copied"; value: T }
  | { status: "failed"; message: string };

const IDLE = { status: "idle" } as const;

/** Keep only the latest clipboard result in the current view. */
export function useClipboardFeedback<T>(scope: unknown) {
  const store = useCreateStore<CopyFeedback<T>>(IDLE);
  const feedback = useSelector(store, (value) => value);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Scope changes invalidate unsettled copies.
  useLayoutEffect(() => () => store.setState(() => IDLE), [scope, store]);
  async function copy(
    write: () => Promise<unknown>,
    result: T,
    errorMessage: (error: unknown) => string,
  ) {
    const attempt = { status: "copying" } as const;
    store.setState(() => attempt);
    try {
      await write();
    } catch (error) {
      store.setState((current) =>
        current === attempt
          ? { status: "failed", message: errorMessage(error) }
          : current,
      );
      return false;
    }
    if (store.get() !== attempt) {
      return false;
    }
    store.setState(() => ({ status: "copied", value: result }));
    return true;
  }
  return { copy, feedback };
}
