import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/**
 * The explicit `Save as Document` write: one Documents create through the
 * Mutation Contract. Nothing else is written.
 */
export function useSaveClosureSummary() {
  return useMutation(orpc.saveProjectClosureSummary.mutationOptions());
}
