import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/**
 * Preview and generate share one read-only call: nothing is persisted, so the
 * result lives only in the caller's state until the draft is discarded or the
 * editor closes.
 */
export function useClosureSummaryDraft() {
  return useMutation(orpc.projectClosureSummaryDraft.mutationOptions());
}
