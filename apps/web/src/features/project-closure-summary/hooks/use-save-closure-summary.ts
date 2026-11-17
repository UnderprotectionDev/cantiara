import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/**
 * The explicit `Save as Document` write: one Documents create through the
 * Mutation Contract. Nothing else is written; the new Document is read into
 * the Documents lists afterwards.
 */
export function useSaveClosureSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.saveProjectClosureSummary.mutationOptions(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orpc.documents.key() }),
  });
}
