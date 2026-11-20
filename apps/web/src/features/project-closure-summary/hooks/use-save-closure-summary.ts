import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";

/**
 * The explicit `Save as Document` write: one Documents create through the
 * Mutation Contract. Nothing else is written; the new Document is read into
 * the Documents lists afterwards.
 */
export function useSaveClosureSummary(
  write?: (
    input: Parameters<typeof client.saveProjectClosureSummary>[0],
  ) => Promise<{ id: string; title: string }>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: orpc.saveProjectClosureSummary.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn:
      write ??
      ((input: Parameters<typeof client.saveProjectClosureSummary>[0]) =>
        client.saveProjectClosureSummary(input)),
    onSuccess: (_, { projectId }) =>
      queryClient.invalidateQueries({
        queryKey: orpc.documents.queryKey({ input: { projectId } }),
      }),
  });
}
