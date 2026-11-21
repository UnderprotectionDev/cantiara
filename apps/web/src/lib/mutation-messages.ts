import { ORPCError } from "@orpc/client";

export function isWriteConflict(error: unknown) {
  return error instanceof ORPCError && error.code === "CONFLICT";
}

export const STALE_BASE_REVISION_MESSAGE =
  "This page is out of date. Refresh to load the current value.";

export function mutationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
