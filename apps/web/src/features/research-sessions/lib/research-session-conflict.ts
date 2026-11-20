import { isDefinedError, ORPCError } from "@orpc/client";

export function isResearchSessionConflict(error: unknown): boolean {
  return (
    error instanceof ORPCError &&
    isDefinedError(error) &&
    error.code === "RESEARCH_SESSION_CHANGED"
  );
}
