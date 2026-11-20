import type { WorkMergeResult } from "@cantiara/api/work-lifecycle";
import {
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import { commandVariables } from "@/lib/command-variables";
import { fetchCurrentWork } from "@/lib/fetch-current-work";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";

export function useWorkMergeUndo(projectId: string) {
  const queryClient = useQueryClient();
  const undoMerge = useMutation(
    orpc.undoWorkMerge.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.undoWorkMerge(input),
      onSuccess: () =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.projectWorks.key({ input: { projectId } }),
          }),
          ...invalidateSmartCollectionMembership(queryClient),
        ]),
    }),
  );
  const receipts = useMutationState({
    filters: {
      exact: true,
      mutationKey: orpc.mergeWork.mutationKey(),
      status: "success",
    },
    select: ({ state }) => state.data as WorkMergeResult | undefined,
  });
  const undone = useMutationState({
    filters: {
      exact: true,
      mutationKey: orpc.undoWorkMerge.mutationKey(),
      status: "success",
    },
    select: ({ state }) =>
      (
        state.variables as
          | Parameters<typeof client.undoWorkMerge>[0]
          | undefined
      )?.mergeId,
  });
  const latest = receipts.findLast(
    (receipt) => receipt?.work.projectId === projectId,
  );
  const lastMergeResult =
    latest && !undone.includes(latest.mergeId) ? latest : undefined;
  const prepareUndo = useMutation({
    meta: { presentsSupportFailure: true },
    mutationFn: (workId: string) => fetchCurrentWork(queryClient, workId),
  });
  const mergeUndoError =
    (undoMerge.variables?.mergeId === lastMergeResult?.mergeId &&
      undoMerge.error) ||
    (prepareUndo.variables === lastMergeResult?.work.id && prepareUndo.error);
  async function confirmUndoMerge() {
    if (!lastMergeResult || undoMerge.isPending || prepareUndo.isPending) {
      return;
    }
    const failed = undoMerge.isError ? undoMerge.variables : undefined;
    if (failed?.mergeId === lastMergeResult.mergeId) {
      undoMerge.mutate(failed);
      return;
    }
    const work = await prepareUndo
      .mutateAsync(lastMergeResult.work.id)
      .catch(() => undefined);
    if (work) {
      undoMerge.mutate(
        commandVariables({
          baseRevision: work.revision,
          mergeId: lastMergeResult.mergeId,
          survivingWorkId: work.id,
        }),
      );
    }
  }

  return {
    confirmUndoMerge,
    lastMergeResult,
    mergeUndoError,
    undoPending: undoMerge.isPending || prepareUndo.isPending,
  };
}
